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
- ~~Duplicidade `ResolveSyncConflictUseCase` + `ResolveConflictUseCase`~~ — ✅ **consolidado (Fase A, 05/11):** a classe única `ResolveSyncConflictUseCase` (nome exigido pela doc §§3.2/11/16.2) absorveu a revisão manual completa (`listConflicts`/`keepLocal`/`useRemote`) e `ResolveConflictUseCase` foi removido; a avaliação automática permanece no domínio (`ConflictResolutionService`). Suíte verde (405/405), typecheck limpo; a doc de software já usava o nome consolidado — agora o código casa com ela.
- ~~Trilha "estágio/relatórios" (`PeriodoAvaliacao`, `Estagio`, `TokenSupervisor`, telas `AssinaturaScreen`/`AtividadesFormScreen`/`HistoricoRelatoriosScreen`)~~ — **decisão explícita registrada:** a trilha é **legado da rubrica original** (template de estágio/relatórios, não do Enlace) e foi **removida deliberadamente** no commit `75bce6c`. Nenhum modelo/service/tela dela voltará sem nova decisão; os nomes do código (`ApproximateLocation`, `SyncState`, etc.) prevalecem sobre os homônimos da rubrica.

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
- [x] **Amarração do fluxo da foto na UI (robustez, seção 7 da apresentação):** o formulário passa a receber o `PhotoStorage` do container (`AnimalFormScreen` + rotas `novo-anuncio`/`editar-anuncio`): ao salvar, a foto capturada é **persistida antes** de anexar — `persistLocal` copia o arquivo para a área segura do app e registra em `local_images` — e a foto no agregado `Animal` leva o **destino definitivo**, não a URI temporária da câmera (que morre quando o app é encerrado; RNF01/RNF02). Ajuste de contrato (doc §13): `PhotoStorage.persistLocal` agora devolve `Promise<AnimalPhoto>` (a foto com o destino), espelhando o padrão de `uploadPending`. Testes: `__tests__/screens/PhotoSaveFlow.test.tsx` (2 casos: foto → storage → destino copiado chega ao repositório; sem foto → storage nunca é chamado). Obs.: na rota de edição a captura de foto é ignorada pelo fluxo atual (foto só no cadastro) — comportamento anterior mantido.
- [ ] **Cache:** garantir que o cache local (anúncios + fotos) sobrevive a fechar/reabrir e atualiza sem bloquear a UI (gancho com RNF13, medido no passo de RNFs remanescentes §3). *(Já garantido por `__tests__/integration/sqlite/real/Persistence.real.test.ts` e o seed do container — falta medir em device.)*

**Bloqueadores §4 a decidir antes:** ~~limite de fotos por anúncio~~ (⚠️ **decidido: 4 fotos**, ver §4); precisão da anonimização de coordenadas.
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

**Feito (código e testes; falta validar no projeto Supabase real e no aparelho):**
- ✅ Bucket público `animal-photos` + políticas por pasta do dono em `supabase/init.sql` (só `image/webp`, até 2 MB; caminho `{auth.uid()}/{animal}/{foto}.webp`, fotos de perfil em `{auth.uid()}/avatar/…`). Leitura por URL pública (anúncios são públicos, RF06).
- ✅ **Conversão obrigatória para WebP** (≤ 1280 px, qualidade 0,8) com `expo-image-manipulator`: `WebpPhotoStorage` converte ANTES de copiar para o armazenamento do app; falha na conversão aborta o salvamento com mensagem ao usuário (nunca grava outro formato).
- ✅ `SupabasePhotoStorage` (`src/infrastructure/supabase/storage/`) implementa o port: upload com `upsert`, recusa não-WebP, exige sessão, grava a URL pública no cache local.
- ✅ Upload ligado ao fluxo: online (criação/edição) e pela fila — sempre ANTES do anúncio (doc §14.1); `animal_photos` registra `remote_url`; falha de upload mantém a ação na fila.
- ✅ Troca de foto na edição do anúncio; arquivos órfãos do bucket são apagados ao trocar a foto e ao excluir o anúncio (best-effort).
- ✅ Foto de perfil sobe ao Storage; a URL fica em `users.avatar_url` (visível em outro aparelho).
- ✅ Ids de anúncio e foto passaram a UUID (o Supabase usa `uuid` nas chaves; antes a sync real falharia).

**Pendente:** aplicar o SQL no projeto real e testar upload/RLS de verdade; reduzir o limite de 2 MB *(limite de fotos por anúncio **decidido: 4** — ver §4*). Código atual: `SqlitePhotoStorage` guarda até 4 fotos por anúncio (validação no agregado `Animal`, `MAX_PHOTOS_PER_ANIMAL`), e o formulário permite adicionar/remover/reordenar até o limite (RF09).

### Passo 5 — Armazenamento no SQLite sincronizando com o Supabase online

**Origem:** RF19–RF23, RF26; UC16–UC18/UC20; doc §§9.3/9.4/14/16.2.

**Feito (código e testes com backend simulado fiel ao `init.sql`; falta validar contra o Supabase real e em aparelho):**
- ✅ Ciclo completo `RunFullSyncUseCase`: **push** (fila) → **pull** (servidor → cache local) → `last_sync_at` em `sync_state`. O pull nunca sobrescreve anúncio com ação pendente na fila.
- ✅ Fila para `animal`, `favorite` e `interest` (idempotente: duplicata no servidor não é falha; favoritar+desfavoritar antes de sincronizar se anulam; ids não-UUID da demo ficam fora).
- ✅ Disparo **automático** ao reconectar, UMA vez por ciclo offline→online (`useAutoSync`/`AutoSync`) e na abertura se já estiver online; botão manual continua na aba Sync.
- ✅ Conflitos (política definitiva de §4): **last-write wins** — `UPDATE` defasado → situação igual = vence a edição com `updatedAt` mais recente, automático (sem perguntar); situação divergente ou anúncio apagado = **revisão** (`ConflictReviewScreen`, rota `/(protected)/conflitos`): manter a minha edição, usar o servidor, recriar ou descartar. Conflito nunca é reenviado sozinho.
- ✅ Moderação admin (UC20): aba **Moderação** (só ADMIN) lista todos os anúncios, oculta e reexibe — `ModerateAnimalUseCase` + RLS `is_admin()`.
- ✅ Responsável vê os **interessados** recebidos (nome, telefone, e-mail; política `interests_animal_owner_read`).
- ✅ E2E §16.4 itens 4, 5, 6 e 8 com SQLite em arquivo (fechar/reabrir) — `__tests__/e2e/OfflineSyncFlows.real.test.ts`. Com os 5 anteriores em mock, os 8 fluxos têm teste.

**Pendente:** validar em aparelho e contra o Supabase real; `UPLOAD_PHOTO` como entidade própria da fila (hoje a foto sobe junto da ação do anúncio); retry com backoff entre tentativas.
**Decisões §4 ainda em aberto (implementadas de forma PROVISÓRIA):** ~~conflito simples vs. revisão~~ (**decidido: last-write wins**, ver §4); tipos de moderação (HIDE/UNHIDE); retenção de interesses; favoritos/interesses entrarem na fila.

---

## §3 — Atividades remanescentes fora dos 5 passos

- **Rotas Expo Router completas:** ✅ `(tabs)` (Início, Favoritos, Meus anúncios, Sync, Moderação, Conta), `/animal/[id]`, `/(protected)/novo-anuncio`, `/(protected)/editar-anuncio`, `/(protected)/conflitos`, `/login`, `/cadastro`, `/` → `/(tabs)`. Guarda de rotas por perfil (`AccessPolicy` + `RequireAccess`). Deep links via `scheme: "enlace"` ainda precisam ser verificados em aparelho.
- **Autenticação e perfis:** ✅ login/cadastro por e-mail e senha (cadastro já entra na conta), política de acesso (visitante / autenticado / admin), tela Conta com foto, descrição e interesses.
- **Mapa (RF05/RF25):** ✅ `react-native-maps` com marcador + círculo de área aproximada (nunca a coordenada exata); na web/Jest cai na lista de pinos. **Raio máximo decidido: 10 km (§4)** — validado por `SearchRadius` (persistência em `search_preferences` recusa raio > 10 km); **filtro por distância (RF04) aplicado à busca**: `AnimalFilterOptions.origin/radiusKm`, haversine puro no domínio (`ApproximateLocation.distanceKmTo`/`distanceKmBetween`), raio normalizado por `SearchRadius.from` no use case (fora da faixa → sem filtro, degradação segura), filtro nas linhas do SQLite antes de carregar fotos e na demo fake; tela de busca com chips de raio ("Sem raio" a "10 km") — a origem é a posição do aparelho pedida **sob ação do usuário** (§0.5/RF24) e, se negada/indisponível, o filtro degrada com aviso (UC01-A3: pesquisar por outra região). Build próprio no Android precisa da chave do Google Maps (`android.config.googleMaps.apiKey`).
- **RNFs de desempenho e escalabilidade (RNF13/14/15):** valores **propostos** na doc §2.2 — abertura de cache ≤ 1 s, operações remotas sem bloquear UI, listagem paginada/limitada no Supabase. **Não medidos**: medir em aparelho real e registrar; se o valor "proposto" for rejeitado, volta ao §4 como bloqueador.
- **E2E e verificação:** ✅ os 8 fluxos do §16.4 têm teste (5 em mock, 4–6 e 8 com SQLite em arquivo + backend simulado). Dependências realinhadas com `npx expo install --fix` → `expo-doctor` **20/20** (6 pacotes do SDK 58 estavam um patch/minor atrás após a reinstalação do checkout). Validação manual em Expo Go/aparelho continua pendente.

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
- [x] Limite de fotos por anúncio → **decidido: 4 fotos por anúncio** (RF09). Enforce no agregado `Animal` (`MAX_PHOTOS_PER_ANIMAL`, constructor/`addPhoto`/`setPhotos` recusam a 5ª) e UI no formulário: adicionar (câmera/galeria), remover e reordenar até o limite. A foto única da edição virou lista de fotos — `UpdateAnimalUseCase` aceita `photos[]`. Testes: `__tests__/domain/PhotoLimit.test.ts`, `__tests__/screens/AnimalFormMultiPhotos.test.tsx`.
- [x] Raio máximo de pesquisa → **decidido: 10 km** (RF04). VO `SearchRadius` (`src/domain/value-objects/SearchRadius.ts`) com `MIN 0 / MAX 10 km` — `SqliteSearchPreferencesRepository.save` e o fake recusam raio acima do máximo e normalizam para 1 casa decimal. **Filtro de distância aplicado à busca (RF04, concluído):** port `AnimalFilterOptions` ganha `origin`/`radiusKm` (0 = sem raio ativo); matemática haversine pura no domínio (`ApproximateLocation.distanceKmTo`/`static distanceKmBetween`, raio terrestre 6371); `SearchAnimalsUseCase` normaliza o raio com `SearchRadius.from` (fora da faixa → filtro degrada sem quebrar a busca; a recusa dura já é na gravação); `SqliteAnimalRepository` filtra nas LINHAS antes do carregamento de fotos (menos consultas) e `AnimalRepositoryFake` replica a regra (demo/testes); `SearchScreen` expõe chips de raio e pede ao `locationGateway` a posição sob ação do usuário (§0.5/RF24) — permissão negada/GPS indisponível → sem filtro + aviso "pesquise por outra região" (UC01-A3), demais filtros intactos. Wiring em `app/(tabs)/index.tsx` (`locationGateway` do container, demo incluído). **Preferências persistidas (`search_preferences`) continuam fora da tela de busca:** a busca é de VISITANTE (sem user_id para chavear `UserId`); integrar é decisão de produto futura. Testes: `__tests__/domain/ValueObjects.test.ts` (haversine: ponto, 1,11 km/0,01°, simetria, sanity longo), `__tests__/application/SearchDistanceFilter.test.ts` (6: raio 5/10, raio 0, sem origem, inválido ignorado, composição), `__tests__/integration/sqlite/SqliteAnimalRepository.test.ts` (distância no SQLite real fake-driver), `__tests__/screens/SearchRadiusFilter.test.tsx` (4: raio aplica, "Sem raio" restaura, UC01-A3 negado, sem gateway).
- [ ] Precisão de anonimização de coordenadas → antes do **Passo 2**
- [x] **Exibição das fotos do anúncio (carrossel + zoom)** → **decidido E implementado (07/11/2026, decisão 16 da doc §18):** na tela de detalhes do pet e no formulário, **≥ 2 fotos** → carrossel com todas (deslizar foto a foto; 1 foto = foto simples); qualquer foto abre em **tela cheia com zoom** (pinça 1x–4x, deslizar entre fotos, toque fecha) — o zoom vale **em cada foto do visualizador**, inclusive após deslizar para outra dentro dele. **Implementação:** componentes `PhotoCarousel` e `PhotoViewer` em `src/adapters/components/` (cada página reutiliza `AnimalPhotoView` — resolução local-primeiro, RNF01/RNF02). **Achado técnico 1:** o zoom nativo do `ScrollView` (`maximumZoomScale`) é SÓ iOS — o `ReactScrollView` do Android não implementa escala. **Achado técnico 2 (device real):** a pinça via `PanResponder` (JS) perde a disputa por toques contra o `ScrollView` horizontal nativo (agressivo no Android) — o usuário não conseguia dar zoom; **aprovada e INSTALADA a dependência mínima `react-native-gesture-handler`** (decisão B2, 07/11/2026 — `expo install` resolveu `~3.3.0`): **implementado** `Gesture.Pinch()` + `Gesture.Pan()` simultâneos via `GestureDetector`, **um detector por página** (zoom em cada foto, inclusive após o swipe); enquanto ampliada a paginação desliga (`scrollEnabled={false}`) e soltar em 1x reativa; `GestureHandlerRootView` na raiz do app (`app/_layout.tsx`) e dentro do Modal (nova hierarquia nativa); helpers puros `clampZoom`/`clampPan` seguem exportados e testados (`pinchDistance` removido — a escala vem do evento nativo da pinça, sem diferença entre toques); mock `react-native-gesture-handler/jestSetup.js` no `jest.config.js` (setupFiles). **Letterbox (decisão do usuário, 07/11/2026) — implementado:** no visualizador, fotos em proporção diferente da tela aparecem **inteiras, centradas, fundo preto** (`resizeMode="contain"`); `AnimalPhotoView` ganha prop `resizeMode` (**default `'cover'`** — zero impacto no herói dos detalhes e no preview do formulário); foto horizontal = toda a largura + barras pretas acima/abaixo, sem corte. Integração: detalhes (herói → carrossel; página 0 mantém testID `animal-photo`, demais `animal-photo-N`; formulário → carrossel por página com ◀/▶/remove **por foto** — testIDs do RF09 (`form-photo-preview`, `photo-index-N`, `btn-photo-*`/`btn-remove-photo-N`, `photo-count`, `photo-status`) 100% preservados e verdes). Dots do carrossel usam **posição otimista** (`goTo` atualiza o indicador na hora e o evento de scroll converge). Testes: `__tests__/components/PhotoCarousel.test.tsx` (5) e `PhotoViewer.test.tsx` (7: helpers de zoom, abre na foto pedida, ✕ fecha, 1 foto sem contador, letterbox, fechado não renderiza) + asserções de `resizeMode` em `AnimalPhotoView.test.tsx`. **Nota RNTL v13:** `render`/`fireEvent`/`rerender` são async — **tudo precisa de `await`** (o código novo segue isso; sem isso as asserções correm antes do flush do estado). **Bug de runtime corrigido:** o early return `if (!visible) return null` do `PhotoViewer` estava **antes do `useEffect`** — a tela mantém o viewer montado com `visible=false`, então a contagem de hooks mudava entre renderizações ("Rendered more hooks than during the previous render" ao abrir a foto); guard movido para **depois de todos os hooks** (early return condicional só após hooks).
- [x] **Características opcionais no formulário** → **decidido E implementado (07/11/2026, decisão 17 da doc §18):** o formulário captura **características, comportamento e cuidados especiais** como campos opcionais (`input-characteristics`/`input-behavior`/`input-special-care`, multiline, rótulo "(opcional)"); espécie/porte/idade/sexo continuam obrigatórios. Pré-preenchidos na edição e entregues ao `AnimalCharacteristics` nos dois caminhos do `handleSubmit` (create/edit; vazios → `undefined`, VO normaliza `''`/`''`/`'Nenhum'`). Testes: `__tests__/screens/AnimalFormOptionalCharacteristics.test.tsx` (3: create preenchido, create vazio não bloqueia, edição pré-preenchida+alterável). **Bug evitado no caminho:** o local `characteristics` do `handleSubmit` sombreava o state do mesmo nome (TDZ) — renomeado para `traits`; inferência: nunca nomear local igual ao state.
- [x] Conflito simples vs. conflito com revisão (política definitiva) → **decidido: last-write wins** para conflito simples (`ConflictResolutionService`: vence a edição com `updatedAt` mais recente, mesmo com versão defasada); **revisão manual mantida** apenas quando a SITUAÇÃO do animal diverge (ex.: "Adotado"), porque o win da última escrita descartaria silenciosamente perda relevante (RF23/RNF03). Fluxo `ConflictReviewScreen` permanece para esses casos. Testes: `__tests__/domain/Services.test.ts` (comportamento já existente — nada mudou no código, só a formalização da política).
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
