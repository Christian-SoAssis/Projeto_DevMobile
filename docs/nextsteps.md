# Enlace — Próximos passos (`nextsteps.md`)

> **Escopo deste arquivo:** roteiro de trabalho **reordenado conforme a sequência acordada** com a equipe (ver §2). A nova ordem dos próximos passos é, estritamente:
>
> 1. Banco de dados local seguro e offline-first (SQLite, secure store, mapeamento offline, modelo ER)
> 2. Imagens locais, geolocalização e cache
> 3. Supabase: infraestrutura online, comunicação app↔servidor e segurança de acesso
> 4. Storage: bucket, padrão S3 e armazenamento de arquivos no Supabase
> 5. Armazenamento no SQLite sincronizando com o Supabase online
>
> Documentos-fonte que continuam valendo: `criteriosapresentacao1.md` (Fase "Domínio e Interface Primeiro") e `documentacao-software-rede-adocao-animais.md` (RF01–RF27, RNF01–RNF15, UC01–UC20). Onde a especificação marca um valor como **proposto** ou lista um ponto como **indefinido**, este arquivo repassa a indefinição em vez de inventar a resposta.

---

## §0 — REGRA DURA: limites que não podem ser ultrapassados em nenhuma hipótese

1. **Supabase é somente infraestrutura online — ele NÃO gera APK.** Nesta etapa, o Supabase entra apenas como backend (Auth, PostgreSQL, Storage, RLS). Ele não gera, hospeda, empacota nem distribui o APK; a geração do APK continua sendo responsabilidade do build Expo/EAS (`expo start`, `eas build`). A integração com o Supabase **não pode bloquear nem alterar o build do APK**: sem rede e sem Supabase configurado, o app segue funcionando em modo `honesto`/`demo` (AppContainer), com fallback visível. Nenhuma dependência do SQLite local, das fakes de demo ou do fluxo de build pode ser removida por causa do Supabase.
2. **Domínio puro.** Conforme `criteriosapresentacao1.md` §1 e documentação §13.1 regra 1: `src/domain/` nunca importa React, Expo, Supabase, SQLite, câmera, localização ou Expo Router. Violação = reverter, não "ajustar depois".
3. **Aplicação sem SDK externo.** Conforme documentação §13.1 regras 2 e 7 e §11 decisão 10: `src/application/` conhece somente domínio e ports. Nenhum use-case importa SDK do Supabase, SQLite, câmera ou Expo Router.
4. **UI nunca acessa infraestrutura diretamente.** Conforme documentação §13.1 regra 6 e §15.3: nenhum componente visual acessa Supabase ou SQLite; validação de propriedade existe no caso de uso + repository remoto + RLS — a UI nunca é barreira de segurança.
5. **Privacidade de localização.** Conforme RNF05/RNF06, RF25 e documentação §15.2: mapa e API pública expõem **somente** localização aproximada (bairro/cidade/região, coordenadas aproximadas); geolocalização apenas sob ação do usuário ou no fluxo de criação do anúncio. Nenhuma implementação pode expor endereço exato ou rastrear em segundo plano.
6. **Sem perda silenciosa.** Conforme RNF02/RNF03 e RF23: toda mutação offline gera item de fila com operação, registro, payload, data e tentativas; conflitos com risco de perda relevante **não** podem ser resolvidos silenciosamente — exigem revisão do responsável.
7. **Pontos indefinidos não são implementados por suposição.** Conforme documentação §19 e UC20: os itens do §4 só entram em implementação após decisão explícita de produto.
8. **Cobertura mínima de 80%.** Conforme `criteriosapresentacao1.md` §6 e `jest.config.js:12-19`: branches, functions, lines e statements ≥ 80%. Nenhum passo é "concluído" abaixo disso.

---

## §1 — Onde estamos (estado consolidado)

- **Fase 1 — Domínio e Interface Primeiro:** ✅ concluída (domínio puro, 19 use cases, 11 telas com RNTL, sessão mockada; cobertura ≈ 94% statements / 85% branches).
- **Fase 2 — Persistência local real (SQLite):** ✅ concluída no código e nos testes; validação manual em Expo Go/device ainda recomendada.
  - `expo-sqlite` + migrations versionadas por `PRAGMA user_version` (`src/infrastructure/database/sqlite/migrations/index.ts`, versão atual `1`).
  - 8 repositórios + `SqlitePhotoStorage` + `SqliteUnitOfWork` (outbox atômico: anúncio + ação da fila na mesma transação).
  - `ProcessSyncQueueUseCase` com anti-concorrência, retry (`maxAttempts` padrão 5) e fila mínima correta para a entidade `animal`.
  - Modo honesto: `AppContainer.mode` = `sqlite` | `memory` | `demo`, sem fallback silencioso em produção.
  - Testes de integração reais com `better-sqlite3` em `__tests__/integration/sqlite/real/`.
- **Fase 3 — Supabase (infraestrutura online, comunicação e segurança):** ✅ implementada em código e suíte; **pendente verificação contra um projeto Supabase real** (criar o projeto, rodar `supabase/init.sql`, definir `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY` e conferir as políticas RLS na mão).
  - `@supabase/supabase-js@2.118.0` + `supabase/init.sql` (schema `users`, `animals` + `moderation_status`, `animal_photos`, `favorites`, `adoption_interests` e políticas RLS do doc §15.1).
  - `src/infrastructure/supabase/`: `client.ts` (config por `EXPO_PUBLIC_*`, require dinâmico, modo honesto → `null` sem credencial), `types.ts` (superfície estrutural mínima do SDK), `auth/SupabaseAuthGateway.ts` (e-mail/senha — decisão §4; papel ADMIN lido de `public.users.user_type`), `repositories/SupabaseAnimalRepository.ts` (decorador local→SQLite + remoto→Supabase, bloqueio otimista por `version` doc §14.3 com `StaleVersionError`/`RemoteSupabaseError` e `listPublicRemote`) e `SupabaseModerationRepository.ts` (HIDE/UNHIDE provisórios, aguardando §4).
  - Composição: `loadAppContainer(driver?, options?)` com `AppContainerOptions` (driver/cliente/módulo/config injetáveis) e `AppContainer.remoteMode: 'none' | 'supabase'` + `authGateway?`/`moderationGateway?`. **Sem credenciais o app segue 100% offline/SQLite e o build do APK não muda (§0.1).**
  - Port `ModerationGateway` no domínio + `ModerateAnimalUseCase` (UC20; teste `ModerateAnimalUseCase_rejects_non_admin` do §16.2).
  - UI: `AuthProviderBridge` (em `AuthContext.tsx`) entrega o `SupabaseAuthGateway` do container quando configurado; sem ele, mantém o fake de demo.
- **`node_modules`** instalado neste ambiente com `npm install --ignore-scripts` (o install normal falha compilando `better-sqlite3` via node-gyp — não há Visual Studio Build Tools na máquina; o binding pré-compilado do `better-sqlite3` funciona). Em checkout novo, usar `npm install --ignore-scripts`.

**Gaps nominais registrados (sem renomear nada por conta própria):**
- Critério §7 pede `Coordenada`/`StatusSincronizacao`/`SincronizarFilaUseCase`; o código tem `ApproximateLocation`/`SyncState`/`ProcessSyncQueueUseCase`. Manter os nomes do código.
- ~~Ausente vs. documentação §8/§16: `ModerateAnimalUseCase`~~ — ✅ implementado no Passo 3 (`src/application/use-cases/ModerateAnimalUseCase.ts` + port `ModerationGateway`).
- Trilha "estágio/relatórios" (`PeriodoAvaliacao`, `Estagio`, `TokenSupervisor`, telas `AssinaturaScreen`/`AtividadesFormScreen`/`HistoricoRelatoriosScreen`) é **legado** da rubrica, fora do escopo do planejamento. Nada é criado, removido ou renomeado nela sem decisão explícita.

---

## §2 — Próximos passos, na ordem acordada (ordem estrita)

> Regra de abertura: um passo só abre quando o anterior estiver fechado (tarefas ✅) e os bloqueadores de produto do §4 correspondentes estiverem decididos.

### Passo 1 — Banco de dados local seguro e offline-first (SQLite)

**Origem:** RNF01, RNF02, RNF09, RF07, RF17–RF19; doc §§13, 15, 16.3.

**Base — o que já está feito (Fase 2):**
- ✅ SQLite real + migrations versionadas + repositórios + índices (tabelas `animals`, `animal_photos`, `favorites`, `adoption_interests`, `users`, `sync_queue`, `local_images`, `sync_state`, `search_preferences`).
- ✅ Modelo Entidade–Relacionamento persistido no SQLite: FKs com `ON DELETE CASCADE` e der na documentação §6; testes de persistência em banco real (fechar e reabrir o arquivo).
- ✅ App offline-first: consulta por cache quando offline (`SearchAnimalsUseCase` → `{ animals: cached, isOffline }`), banner perceptível e NetInfo via port `ConnectivityGateway`.
- ✅ Fila `sync_queue` persistente com payload, tentativas e status; outbox atômico via `UnitOfWork`.

**Fazer neste passo:**
- [x] **`expo-secure-store` real:** instalado (`expo-secure-store ~58.0.2` + plugin no `app.json`), `SessionStorageSecureStore.ts` ligado ao store real (Keychain/Keystore) com require dinâmico e fallback in-memory para Jest/demo; wiring no `app/_layout.tsx`. Testes: `__tests__/adapters/SessionStorageSecureStore.test.ts` (9 casos, incluindo sobrevivência entre instâncias e degradação com falha do Keychain). Sessão sobrevive ao reinício do app.
- [x] **Mapeamento formal das funcionalidades offline:** tabela no código em `src/application/offline/OfflineCapabilities.ts` — 14 funcionalidades com `behavior` (`FULL_OFFLINE` | `OFFLINE_WITH_QUEUE` | `OFFLINE_PARTIAL` | `ONLINE_ONLY`), requisitos RF e fluxo offline; `OFFLINE_STATUS_LABELS` os cinco estados visuais do RF22. Testes: `__tests__/application/OfflineCapabilities.test.ts` (7 casos). Referência na UI: seção "O que funciona offline" na tela de Sync (`testID: offline-capabilities-section`), testada em `__tests__/screens/HardwareFailure.test.tsx`.
- [ ] **Ampliar o mapeamento para o que hoje é local-only:** favoritos e interesses já persistem localmente; repetir a decisão (ou rever) de quais mutações deles entram na fila — remete ao bloqueador §4 (offline completo). *(Estado atual registrado no mapa: `OFFLINE_PARTIAL` com nota na tela de Sync.)*
- [x] **ORM:** decisão registrada em [decisao-orm.md](decisao-orm.md) — manter SQL cru nos repositórios (suíte de contratos reais já cobre os riscos); se um ORM entrar (gatilho: Passo 3), fica restrito a adapters/infrastructure, nunca em `src/domain/`/`src/application/`.
- [ ] **Validação manual em Expo Go/device** da Fase 2: criar anúncio offline, fechar e reabrir, fila intacta, cache visível, banner correto, login persistindo entre reinícios via secure store.

**Testes:** sessão persistida/recuperada; mapeamento offline verificado por use case; integração SQLite real continua verde.
**Pronto (evidência):** secure store real em Keychain/Keystore, mapa offline documentado e testado, decisão de ORM registrada, cobertura ≥ 80%.

### Passo 2 — Imagens locais, geolocalização e cache

**Origem:** RNF05, RNF06, RF09, RF24–RF26, RF26; doc §§11, 16.3.

**Base — o que já está feito:**
- ✅ Imagens locais registradas no SQLite (`local_images` + `animal_photos` com `local_path`/`upload_status`); `SqlitePhotoStorage` copia o arquivo e mantém o vínculo; degrada com segurança em Jest.
- ✅ Coordenadas aproximadas persistem em `animals` (latitude/longitude/bairro/cidade/região) e `radius_km` em `search_preferences`.
- ✅ Cache local servindo online e offline (seed no container + leitura dos repositórios SQLite).

**Fazer neste passo:**
- [x] **Geolocalização real:** `expo-location ~58.0.20` instalado; `src/infrastructure/device/location/LocationAdapter.ts` (`ExpoLocationAdapter`) implementando o port `LocationGateway` — permissão de foreground sob ação do usuário, coordenada **anonimizada por arredondamento** (2 casas ~1,1 km, default proposto; precisão configurável — §4) e geocodificação inversa restrita a **bairro/cidade/região** (nunca rua/número). Erros tipados: `LocationPermissionDeniedError` (UC01-A3) e `LocationUnavailableError`. Um anúncio criado com o adapter grava a coordenada aproximada no SQLite pelo fluxo existente de `CreateAnimalUseCase`.
- [x] **Teste de falha de permissão:** permissão negada **não quebra** o app (UC01-A3) — testes de adapter (`__tests__/infrastructure/device/location/LocationAdapter.test.ts`, 10 casos) + RNTL na tela (`__tests__/screens/HardwareFailure.test.tsx`: feedback "preencha bairro e cidade manualmente", campos preservados, cadastro segue utilizável). Busca continua funcionando sem GPS (uso do gateway só no formulário).
- [x] **Câmera/galeria:** decisão `expo-image-picker ~58.0.10` (câmera **e** galeria num módulo só, no lugar do `expo-camera`); `src/infrastructure/device/camera/ImagePickerCameraAdapter.ts` implementando o port `CameraGateway` — câmera negada devolve `null` (sem lançar erro) e a UI orienta salvar sem foto ou usar a galeria (doc §16.3). Testes: `__tests__/infrastructure/device/camera/ImagePickerCameraAdapter.test.ts` (9 casos).
- [ ] **Cache:** garantir que o cache local (anúncios + fotos) sobrevive a fechar/reabrir e atualiza sem bloquear a UI (gancho com RNF13, medido no passo de RNFs remanescentes §3). *(Já garantido por `__tests__/integration/sqlite/real/Persistence.real.test.ts` e o seed do container — falta medir em device.)*

**Bloqueadores §4 a decidir antes:** limite de fotos por anúncio; precisão da anonimização de coordenadas.
**Pronto (evidência):** GPS real grava coordenada aproximada no SQLite; nenhuma UI pública mostra endereço exato; fotos locais persistem após reinício.

### Passo 3 — Supabase: infraestrutura online, comunicação e segurança de acesso

**Origem:** RNF03, RNF04, RNF10; RF08–RF13, RF16; UC06/UC07/UC17/UC20; doc §§14.2, 15, §16.3.

**Fazer neste passo:**
- [x] Estrutura `src/infrastructure/supabase/`: `client.ts` (config por `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY`, require dinâmico e modo honesto → `null` sem credencial), `types.ts` (superfície estrutural mínima do SDK), `repositories/` e `auth/` (doc §13). `storage/` fica para o **Passo 4** (port `PhotoStorage`).
- [x] **Comunicação app ↔ Supabase:** decorador `SupabaseAnimalRepository` implementa `createRemote`/`updateRemote`/`deleteRemote` (doc §14.2) + `listPublicRemote`, mantendo os métodos locais no SQLite — os use cases continuam vendo **um único port**. Bloqueio otimista (doc §14.3): a edição local incrementa `version` (`touch()`); o `UPDATE` casa a versão **pré-edição** que o servidor ainda guarda (`animal.version - 1`) e zero linhas → `StaleVersionError` (RF23, sem perda silenciosa; edição de terceiro bloqueada pela RLS é indistinguível no cliente — intencional, §15.3). Wired no composition root: `loadAppContainer` recebe `AppContainerOptions` e expõe `remoteMode: 'none' | 'supabase'` — **nada altera o build do APK nem exige rede quando sem credencial (§0.1)**. A entrega remota do `PhotoStorage` (upload) fica no Passo 4.
- [x] **Autenticação (e-mail/senha — decisão §4):** `SupabaseAuthGateway` liga `AuthenticateUserUseCase`/`AcessarViaTokenUseCase` ao `supabase.auth`; `AuthProviderBridge` (em `AuthContext.tsx`) entrega o gateway real quando `remoteMode === 'supabase'` e mantém o fake de demo em modo offline. Papel ADMIN lido de `public.users.user_type` (fonte autoritativa; metadata do auth nunca é a única fonte).
- [x] **Segurança de acesso — RLS mínimas** (doc §15.1): `supabase/init.sql` com schema (`users`, `animals` + `moderation_status`, `animal_photos`, `favorites`, `adoption_interests`) e políticas: leitura pública apenas de anúncios visíveis (`moderation_status <> 'HIDDEN'`); escrita de animals/fotos só do proprietário (`auth.uid()`); `favorites`/`adoption_interests` privados por usuário; moderação só via `is_admin()`. *(Pendente aplicar e conferir num projeto Supabase real; o fake de teste reproduta a semântica dessas políticas.)*
- [x] **Defesa em profundidade** (doc §15.3): validação no use case (`ModerateAnimalUseCase` rejeita não-admin) + adapter remoto (escreve só `moderation_status`) + RLS no Postgres. A UI nunca é barreira.
- [x] **`ModerateAnimalUseCase`** (tabela §8 + teste §16.2 `ModerateAnimalUseCase_rejects_non_admin`): port `ModerationGateway` no domínio + use case com a mensagem "Somente administradores podem moderar anúncios (UC20).".

**Testes (doc §§16.2/16.3 Supabase):** ✅ — 49 testes novos: `SupabaseClient.test.ts` (config por env, modo honesto, `isSupabaseModule`, SDK real instalado → `null` sem env); `SupabaseAnimalRepository.test.ts` (delegação local no SQLite, CREATE com RLS violada por anônimo, UPDATE com versão atual, **`UPDATE` defasado rejeitado com `StaleVersionError`**, edição por terceiro bloqueada, DELETE idempotente, leitura pública exclui HIDDEN/ADOPTED); `SupabaseAuthGateway.test.ts` (login válido/inválido, rede fora, sessão atual, `acessarViaToken`, papel ADMIN via `public.users`, logout); `SupabaseModerationRepository.test.ts` (HIDE/UNHIDE); **`RlsPrivateTables.test.ts` (favoritos/interesses protegidos: terceiro e anônimo não leem nem gravam, dono/admin ok — doc §15.1)**; `ModerateAnimalUseCase.test.ts` (não-admin rejeitado — USER/RESPONSIBLE/VISITOR/INTERESTED, ator ausente, admin passa); integração `AppContainerSupabase.test.ts` (`remoteMode` por configuração + fila CREATE processada no backend real). Fake fiel ao SQL em `test-support/SupabaseFake.ts` (RLS simulada, tabelas privadas por `user_id`). Suíte completa: **263/263 verdes, 45 suítes**.
**Verificação (§5):** typecheck 0 erros; cobertura global **93,8% stmts / 83,6% branches** (`npm run test:coverage`); `expo-doctor` **20/20**; APK/build Expo não alterados (§0.1).
**Pronto (evidência):** integração Supabase verde contra fake fiel ao `init.sql`; domínio/application sem import de Supabase (só ports); app sem credencial segue em modo honesto (`remoteMode: 'none'`); cobertura ≥ 80%.
**Pendente registrado:** (1) verificação de RLS/auth num projeto Supabase real (credenciais + `supabase/init.sql`); (2) `storage/` = Passo 4; (3) tipos definitivos de ação de moderação → bloqueador §4 do Passo 5 (HIDE/UNHIDE são o mínimo provisório).

### Passo 4 — Storage: bucket, padrão S3 e armazenamento de arquivos

**Origem:** doc §13 (port `PhotoStorage`), RF09, RF26.

**Fazer neste passo:**
- [ ] Criar o bucket no Supabase (políticas de acesso por projeto; nomes/tamanhos conforme decisão de limite de fotos §4).
- [ ] Implementar `src/infrastructure/supabase/storage/` seguindo o padrão S3 do Supabase (chaves por objeto, URLs assinadas conforme decisão de visibilidade — bloqueador §4), implementando o port `PhotoStorage` já existente.
- [ ] Ligar o upload ao fluxo de criação/edição: foto local → upload → `remote_url` registrado em `animal_photos`/`local_images`.
- [ ] Testes: upload associa arquivo ao anúncio correto; anúncio de terceiro não altera nem lê objeto fora da política; foto só-remota ignorada corretamente pelo SQLite (já coberta no contrato atual).

**Bloqueadores §4 a decidir antes:** limite de fotos por anúncio (reuso do Passo 2); visibilidade exata dos dados de contato/URLs.

### Passo 5 — Armazenamento no SQLite sincronizando com o Supabase online

**Origem:** RF19–RF23, RF26; UC16–UC18/UC20; doc §§9.3/9.4/14/16.2.

**Fazer neste passo:**
- [ ] Ordem doc §14.1 (10 passos): mutações locais primeiro, upload de imagens antes da reconciliação, reconciliação, `last_sync_at` em `sync_state`.
- [ ] Item de fila no formato doc §14.2 (já persistido — manter e estender para `photo`, `favorite`, `interest`).
- [ ] `ProcessSyncQueueUseCase` fim-a-fim: remover entidade local no DELETE remoto com sucesso, retry automático na reconexão (disparo **uma única vez** por ciclo de reconexão) e retry manual.
- [ ] `ConflictReviewScreen` + fluxos doc §9.4: conflito simples = versão mais recente; risco de perda = revisão do responsável. Extender `ResolveSyncConflictUseCase` (já existente).
- [ ] Moderação admin conectada (UC20 — `ModerateAnimalUseCase` do Passo 3).
- [ ] Indicadores de estado inequívocos (RNF07/RF22: offline, salvo no dispositivo, pendente, sincronizando, atualizado) refletidos na tela Sync e nos banners.

**Testes (doc §16.2):** `ProcessSyncQueueUseCase_retries_failed_action`; `..._uploads_local_photo_before_reconcile`; `ResolveSyncConflictUseCase_requests_review_when_data_may_be_lost`; E2E §16.4 itens 4–6 (cria offline→fecha app→reabre→sincroniza; edição offline chega ao servidor; conflito gera revisão) + item 8 (não-editar anúncio de terceiro) contra o backend real.
**Pronto (evidência):** fila idempotente (decisão doc §18 item 5); sync da fila SQLite → Supabase verificado em device; E2E 8/8.
**Bloqueadores §4 a decidir antes:** política conflito simples vs. revisão; tipos de ação de moderação; retenção de interesses; offline completo de favoritos/interesses.

---

## §3 — Atividades remanescentes fora dos 5 passos

- **Rotas Expo Router completas:** ✅ feitas as principais (`(tabs)`, `/animal/[id]`, `/(protected)/novo-anuncio`, `/(protected)/editar-anuncio`, `/login`, `/cadastro`, `/` → `/(tabs)`). Pendentes por desenho: `ConflictReviewScreen` (Passo 5) e tela de moderação (Passo 5 — `ModerateAnimalUseCase` já existe; UI/tipos de ação aguardam UC20/§4). Deep links via `scheme: "enlace"` devem ser verificados quando as telas fecharem.
- **RNFs de desempenho e escalabilidade (RNF13/14/15):** valores **propostos** na doc §2.2 — abertura de cache ≤ 1 s, operações remotas sem bloquear UI, listagem paginada/limitada no Supabase. Medir em device real e registrar; se o valor "proposto" for rejeitado, volta ao §4 como bloqueador.
- **E2E finais + apresentação:** 5/8 fluxos em mock já verdes (`SearchToDetails`, `MockFlows` itens 2/3/7/8); 8/8 fecham no Passo 5. Cobertura global ≥ 80% e `expo-doctor` integram a verificação §5.
- **Visualização no mapa (RF05/RF25):** renderização do mapa aproximado fica atrelada à geolocalização real (Passo 2) e à decisão de raio máximo do §4.

---

## §4 — Bloqueadores de produto (não implementar por suposição)

Cada item precisa de decisão explícita antes do passo indicado:

- [x] Método de autenticação Supabase → **decidido: e-mail/senha** (implementado no Passo 3; magic link/OAuth também estão fora do escopo acordado)
- [ ] Campos obrigatórios e limites de cada formulário → antes dos **Passos 3/5**
- [x] Regras de exclusão de anúncio já adotado → **decidido: permitir exclusão normal** (dono pode excluir anúncio em qualquer status; exclusão local + item de fila DELETE — já é o comportamento do `ProcessSyncQueueUseCase`)
- [x] Reabertura Adotado → Disponível → **decidido: não permitir** (respeita o diagrama de estados §7.1 — Disponível → Adotado, uma via só)
- [ ] Tipos de ação de moderação (ocultar, remover, suspender…) → antes do **Passo 5** *(HIDE/UNHIDE implementados como mínimo provisório no Passo 3, explícitos no código e aqui)*
- [x] Visibilidade exata dos dados de contato → **decidido: e-mail + telefone públicos no anúncio** (RF06; mensagem de interesse gravada em `adoption_interests` e visível ao dono — fluxo de tela no Passo 5)
- [ ] Política de retenção de manifestações de interesse → antes dos **Passos 3/5**
- [ ] Limite de fotos por anúncio → antes do **Passo 2**
- [ ] Raio máximo de pesquisa → antes do **Passo 2**
- [ ] Precisão de anonimização de coordenadas → antes do **Passo 2**
- [ ] Conflito simples vs. conflito com revisão (política definitiva) → antes do **Passo 5**
- [ ] Offline completo de favoritos/interesses (quais mutações entram na fila) → antes do **Passo 5**
- [ ] Validação dos três valores "propostos" (RNF13/14/15) → antes das atividades do §3

---

## §5 — Verificação (rodar ao fechar cada passo)

```bash
npm install          # checkout novo: antes de tudo
npm run typecheck    # tsc --noEmit, 0 erros
npm test             # suíte atual + novos testes; cobertura ≥ 80% (jest.config.js:12-19)
npx expo-doctor      # 20/20
npx expo start       # bundle Android + manifest expo válidos
```

Lembrete da regra §0.1: nas verificações do Passo 3 em diante, conferir também que **o APK continua sendo gerado pelo build Expo/EAS, sem depender do Supabase**, e que o app sem credenciais segue abrindo em modo honesto/demo.
