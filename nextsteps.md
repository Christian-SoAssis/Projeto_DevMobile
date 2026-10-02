# Enlace — Próximos passos (`nextsteps.md`)

> **Escopo deste arquivo:** mapeamento dos próximos passos estritamente a partir de dois documentos-fonte do repositório:
> - `criteriosapresentacao1.md` — Fase "Domínio e Interface Primeiro" (100% mock, cobertura 80%+).
> - `documentacao-software-rede-adocao-animais.md` — especificação do app Rede de Adoção de Animais (RF01–RF27, RNF01–RNF15, UC01–UC20).
>
> Nada fora desses dois arquivos foi assumido. Onde a especificação marca um valor como **proposto** ou lista um ponto como **indefinido**, este arquivo repassa a indefinição em vez de inventar a resposta.

---

## §0 — REGRA DURA: os limites dos critérios não podem ser ultrapassados em nenhuma hipótese

As proibições abaixo valem **sempre**, sem exceção, atalho ou "só desta vez":

1. **Fase atual é 100% mock/fake.** Conforme `criteriosapresentacao1.md` §5, é proibido conectar qualquer dado a banco permanente (`expo-sqlite`, `@supabase/supabase-js`) ou a hardware real (`expo-camera`, `expo-location`) enquanto a Fase 1 ("Domínio e Interface Primeiro") não for declarada concluída e os próximos passos deste arquivo não forem formalmente abertos.
2. **Domínio puro.** Conforme `criteriosapresentacao1.md` §1 e documentação §13.1 regra 1: `src/domain/` nunca importa React, Expo, Supabase, SQLite, câmera, localização ou Expo Router. Violação = reverter, não "ajustar depois".
3. **Aplicação sem SDK externo.** Conforme documentação §13.1 regras 2 e 7 e §11 decisão 10: `src/application/` conhece somente domínio e ports. Nenhum use-case importa SDK do Supabase, SQLite, câmera ou Expo Router.
4. **UI nunca acessa infraestrutura diretamente.** Conforme documentação §13.1 regra 6 e §15.3: nenhum componente visual acessa Supabase ou SQLite; validação de propriedade existe no caso de uso + repository remoto + RLS — a UI nunca é barreira de segurança.
5. **Privacidade de localização.** Conforme RNF05/RNF06, RF25 e documentação §15.2: mapa e API pública expõem **somente** localização aproximada (bairro/cidade/região, coordenadas aproximadas); geolocalização apenas sob ação do usuário ou no fluxo de criação do anúncio. Nenhuma implementação pode expor endereço exato ou rastrear em segundo plano.
6. **Sem perda silenciosa.** Conforme RNF02/RNF03 e RF23: toda mutação offline gera item de fila com operação, registro, payload, data e tentativas; conflitos com risco de perda relevante **não** podem ser resolvidos silenciosamente — exigem revisão do responsável.
7. **Pontos indefinidos não são implementados por suposição.** Conforme documentação §19 e UC20: os 13 itens listados no §4 deste arquivo só entram em implementação após decisão explícita de produto.
8. **Cobertura mínima de 80%.** Conforme `criteriosapresentacao1.md` §6 e `jest.config.js:12-19`: branches, functions, lines e statements ≥ 80%. Nenhuma fase é "concluída" abaixo disso.

---

## §1 — Onde estamos: Fase 1 ("Domínio e Interface Primeiro")

Ordem de construção exigida por `criteriosapresentacao1.md` §7, com o status verificado no código:

| # | Item do checklist (§7) | Status | Evidência no repo |
|---|---|---|---|
| 1 | Value Objects | ✅ Feito | `src/domain/value-objects/` — `ApproximateLocation.ts`, `AnimalCharacteristics.ts`, `AdoptionStatus.ts`, `SyncState.ts`, `ContactInfo.ts` (trilha adoção) + `Criterio.ts`, `Assinatura.ts`, `CargaHoraria.ts`, `StatusPeriodo.ts` (trilha estágio, ver §7) |
| 2 | Entities & Aggregates | ✅ Feito | `src/domain/entities/` — `Animal.ts`, `AnimalPhoto.ts`, `Favorite.ts`, `AdoptionInterest.ts`, `SyncAction.ts`, `User.ts` + `PeriodoAvaliacao.ts`, `Estagio.ts`, `TokenSupervisor.ts` (trilha estágio) |
| 3 | Domain Services | ✅ Feito | `src/domain/services/` — `SincronizacaoService.ts`, `ConflictResolutionService.ts`, `RegraDevolucaoService.ts`, `RegraGeracaoPdfService.ts` |
| 4 | Interfaces Repository/Gateway | ✅ Feito | `src/domain/ports/` com 11 contratos, incluindo `PhotoStorage.ts` (doc §13) + `PhotoStorageFake` em `src/application/fakes/` com teste dedicado |
| 5 | Use Cases com fakes in-memory (TDD Red-Green-Refactor) | ✅ Feito | `src/application/use-cases/` (19 arquivos) + `src/application/fakes/` (10 fakes em `Map`). Cobrem UC01–UC02/UC05/UC07/UC09–UC11/UC13–UC18 (adoção) e relatório/avaliação/assinatura/aprovação/devolução/PDF/token (estágio) |
| 6 | Context API + Custom Hooks | ✅ Feito | `src/adapters/context/AuthContext.tsx`, `src/adapters/hooks/useAnimals.ts`, `useSync.ts`, `useAtividades.ts` |
| 7 | Telas com RNTL + fakes injetados | ⚠️ Parcial | 7 screens existem em `src/adapters/screens/`, mas `app/` só tem `app/_layout.tsx` + `app/index.tsx` (só `SearchScreen` roteada). Faltam as rotas da tabela Boundary da documentação §8: detalhes, novo/editar anúncio, meus anúncios, favoritos, sync, conflito, moderação, login/cadastro |
| 8 | Sessão segura (`SessionStorageSecureStore` + `expo-secure-store` mockado) | ⚠️ Parcial | `src/adapters/auth/SessionStorageSecureStore.ts` existe, mas `expo-secure-store` **não** está em `package.json:14-25` — opera apenas mockada, como manda o critério §5 |

**Base técnica validada:** Expo SDK 57 (`package.json:15`), `expo-doctor` 21/21, `tsc --noEmit` limpo, 97/97 testes verdes, bundle Android + manifest `exposdk:57.0.0` confirmados.

**Gaps nominais a registrar (sem renomear nada por conta própria):**
- Critério §7 pede `Coordenada` / `StatusSincronizacao` / `SincronizarFilaUseCase`; o código tem `ApproximateLocation` / `SyncState` / `ProcessSyncQueueUseCase`. Manter os nomes do código; eventual unificação é decisão futura, não próximo passo.
- Ausente vs. documentação §8/§16: `ModerateAnimalUseCase`. As formas puras `SearchPreferences` (VO, doc §4.1, sem regras) e `SyncMetadata` (entidade, doc §§4.1/5.1) já existem; a persistência de `SearchPreferences` continua tarefa da Fase 2.

---

## §2 — O que FICA EM MOCK nesta fase (proibido trocar por real)

Cópia estrita de `criteriosapresentacao1.md` §5:

- [ ] **Sem armazenamento permanente real:** nenhuma conexão ativa com `expo-sqlite` ou `@supabase/supabase-js`. Ambos **ausentes** de `package.json:14-25` — e devem continuar ausentes até a abertura formal das Fases 2–3.
- [ ] **Sem sensores nativos reais:** câmera (`expo-camera`) e localização (`expo-location`) somente via gateways fakes/mocks em teste (`CameraGatewayFake`, `LocationGatewayFake`).
- [ ] **Repositórios em `Map` + stubs de sessão:** telas montadas com fakes injetados e sessões stub válidas.

---

## §3 — Próximos passos, em fases (ordem estrita)

> Regra de abertura: nenhuma fase começa sem a anterior ter seus "Critérios de pronto" cumpridos **e** sem os bloqueadores do §4 correspondentes estarem decididos.

### Fase 2 — Persistência local real (SQLite)
- **Origem:** RNF01, RNF02, RNF09 (cache/fila sobrevivem ao reinício); RF17–RF19; UC15/UC16; documentação §§5.1, 13, 16.3.
- **Criar:**
  - `src/infrastructure/database/sqlite/migrations/` — tabelas `sync_queue`, `local_images`, `sync_state`, `search_preferences` (colunas exatas da doc §5.1) + cache de `animals`, `animal_photos`, `favorites`, `adoption_interests` (doc §4.2).
  - `src/infrastructure/database/sqlite/repositories/` — implementações SQLite dos ports existentes (`AnimalRepository`, `FavoriteRepository`, `AdoptionInterestRepository`, `SyncQueueRepository`, `UserRepository`) + criar `SearchPreferences` persistido (doc §§4.1/5.1).
- **Testes (doc §16.3 SQLite):** migrations criam todas as tabelas; cache persiste após reinício; fila mantém payload e tentativas; transação anúncio + ação pendente é atômica.
- **Pronto:** testes §16.3 SQLite verdes; cobertura ≥ 80%; domínio/application sem import de `expo-sqlite` (regra §13.1).

### Fase 3 — Backend Supabase (Auth, PostgreSQL, Storage, RLS)
- **Origem:** RNF03, RNF04, RNF10; RF08–RF13, RF16; UC06/UC07/UC17/UC20; documentação §§14.2, 15, 16.3.
- **Criar:**
  - `src/infrastructure/supabase/client.ts`, `repositories/`, `auth/`, `storage/` (estrutura da doc §13).
  - `ModerateAnimalUseCase` (tabela §8 + teste §16.2 `ModerateAnimalUseCase_rejects_non_admin`). O port `src/domain/ports/PhotoStorage.ts` + `PhotoStorageFake` já existem (Fase 1 concluída).
  - Políticas RLS mínimas da tabela doc §15.1 (leitura pública de `animals` ativos; escrita só proprietário; `favorites`/`adoption_interests` privados; moderação só admin).
- **Testes (doc §§16.2/16.3 Supabase):** RLS leitura pública OK; edição por terceiro bloqueada; favoritos/interesses protegidos; upload associa arquivo ao anúncio correto; `UPDATE` com `version` antiga é rejeitado (doc §14.3).
- **Pronto:** integração Supabase verde; defesa em profundidade §15.3 (caso de uso + repository remoto + RLS); cobertura ≥ 80%.
- **Bloqueador:** método de autenticação (e-mail/senha, magic link, OAuth…) — doc §19 item 1 — decidir **antes** de implementar `supabase/auth/`.

### Fase 4 — Dispositivo real (câmera, localização, conectividade, sessão segura)
- **Origem:** RNF05, RNF06; RF09, RF24–RF26; UC07–UC08/UC17; documentação §§11, 16.3.
- **Criar/instalar:** `expo-secure-store`, `expo-camera` (ou image-picker conforme decisão), `expo-location`, `@react-native-community/netinfo`; `src/infrastructure/device/{camera,location,connectivity}/` + `LocationAdapter` e `PhotoAdapter` implementando os ports (doc §11); ligar `SessionStorageSecureStore.ts` ao store real (Keychain/Keystore, critério §3).
- **Testes (doc §16.3 Dispositivo):** permissão de localização negada não quebra a busca (UC01-A3); câmera negada permite galeria quando aplicável; reconexão dispara sincronização uma única vez por ciclo.
- **Pronto:** telas usam gateways reais com fallback fake em teste; nenhum endereço exato chega à UI pública (§0 item 5).
- **Bloqueadores (doc §19):** limite de fotos por anúncio; precisão de anonimização de coordenadas — decidir **antes**.

### Fase 5 — Rotas Expo Router completas
- **Origem:** tabela Boundary doc §8; estrutura doc §13 (`(public)/`, `(tabs)/`, `(protected)/`); UC01–UC06.
- **Criar em `app/`:** pública (busca/lista/mapa/detalhes), tabs (início, busca, favoritos), protegidas (novo/editar anúncio, meus anúncios, gestão/adoção, sync, revisão de conflito, moderação admin, login/cadastro). Hoje só existem `app/_layout.tsx` e `app/index.tsx`.
- **Testes:** RNTL por tela com fakes (padrão critérios §6: `render`, `fireEvent.press`, `fireEvent.changeText` dentro de `<AuthProvider>`); E2E §16.4 item 1 (visitante pesquisa e abre um animal).
- **Pronto:** todas as telas da tabela §8 roteadas; deep links via `scheme: "enlace"` (`app.json:7`) funcionais.
- **Bloqueadores (doc §19):** visibilidade exata dos dados de contato — decidir **antes** da tela de detalhes final.

### Fase 6 — Sincronização fim-a-fim + conflito + moderação
- **Origem:** RF19–RF23, RF26; UC16–UC18/UC20; documentação §§9.3/9.4/14/16.2.
- **Implementar:** ordem doc §14.1 (10 passos, mutações locais primeiro, upload de imagens, reconciliação, `last_sync_at`); item de fila no formato doc §14.2; `ConflictReviewScreen` + fluxos doc §9.4 (conflito simples = versão mais recente; risco de perda = revisão do responsável); moderação admin (UC20).
- **Testes (doc §16.2):** `ProcessSyncQueueUseCase_retries_failed_action`; `..._uploads_local_photo_before_reconcile`; `ResolveSyncConflictUseCase_requests_review_when_data_may_be_lost`; E2E §16.4 itens 4–6 (offline→fecha app→sincroniza; edição offline chega ao servidor; conflito gera revisão) + item 8 (não-editar anúncio de terceiro).
- **Pronto:** fila idempotente (decisão §18 item 5); retry manual + automático (RF21); indicador de estado inequívoco (RNF07/RF22).
- **Bloqueadores (doc §19 + UC20):** política conflito simples vs. revisão; tipos de ação de moderação; retenção de interesses; quais mutações de favoritos/interesses têm offline completo — decidir **antes**.

### Fase 7 — RNFs de desempenho e escalabilidade
- **Origem:** RNF13, RNF14, RNF15 — todos marcados como **"proposto"** na documentação §2.2.
- **Implementar:** abertura de cache local ≤ 1 s (dispositivo intermediário); operações remotas com loading sem bloquear UI; listagem paginada/limitada no Supabase.
- **Pronto:** metas medidas em dispositivo real e registradas aqui; nenhuma meta é apertada por suposição — se o valor "proposto" for rejeitado, volta ao §4 como bloqueador.

### Fase 8 — E2E finais + apresentação
- **Origem:** doc §16.4 (8 fluxos) + pirâmide de testes critérios §6 (E2E pouquíssimos, só críticos).
- **Executar na ordem:** 1) visitante pesquisa e abre animal; 2) autentica e favorita; 3) responsável cria online; 4) cria offline→fecha→reabre→sincroniza; 5) edita offline→chega ao servidor; 6) conflito; 7) marca adotado; 8) terceiro não edita.
- **Pronto:** 8/8 verdes; cobertura global ≥ 80%; `expo-doctor` 21/21.

---

## §4 — Bloqueadores de produto (não implementar por suposição)

Direto da documentação §19 + indefinição da UC20 (doc §3.2). Cada item precisa de decisão explícita antes da fase indicada:

- [ ] Método de autenticação Supabase (e-mail/senha, magic link, OAuth…) → antes da **Fase 3**
- [ ] Campos obrigatórios e limites de cada formulário → antes das **Fases 3/5**
- [ ] Regras de exclusão de anúncio já adotado → antes das **Fases 3/6**
- [ ] Reabertura Adotado → Disponível (permitida ou não) → antes das **Fases 3/6** (o diagrama de estados §7.1 só prevê Disponível → Adotado)
- [ ] Tipos de ação de moderação (ocultar, remover, suspender…) → antes da **Fase 6** (UC20)
- [ ] Visibilidade exata dos dados de contato → antes da **Fase 5**
- [ ] Política de retenção de manifestações de interesse → antes das **Fases 3/6**
- [ ] Limite de fotos por anúncio → antes da **Fase 4**
- [ ] Raio máximo de pesquisa → antes das **Fases 2/5**
- [ ] Precisão de anonimização de coordenadas → antes da **Fase 4**
- [ ] Conflito simples vs. conflito com revisão (política definitiva) → antes da **Fase 6**
- [ ] Offline completo de favoritos/interesses (quais mutações entram na fila) → antes da **Fase 6**
- [ ] Validação dos três valores "propostos" (RNF13/14/15) → antes da **Fase 7**

---

## §5 — Matriz requisito → fase (resumo da rastreabilidade doc §17)

| RF | Fase |
|---|---|
| RF01–RF05 (consulta, início, pesquisa, filtros, lista/mapa) | Fases 2 + 5 |
| RF06 (detalhes) | Fase 5 |
| RF07 (cadastro/login/sessão) | Fases 3 + 4 |
| RF08–RF09 (criar anúncio + fotos) | Fases 3 + 4 |
| RF10–RF13 (editar/excluir próprios, marcar adotado, meus anúncios) | Fases 3 + 5 + 6 |
| RF14–RF16 (favoritos, listar favoritos, interesse) | Fases 3 + 5 (+ §4 decisão offline) |
| RF17–RF22 (offline, fila, sync, retry, estados) | Fases 2 + 6 |
| RF23 (conflitos) | Fase 6 |
| RF24–RF25 (localização pontual, mapa aproximado) | Fase 4 |
| RF26 (imagens offline até upload) | Fases 2 + 6 |
| RF27 (moderação) | Fase 6 (bloqueada até decisão UC20) |

RNFs: RNF01/02/09 → Fase 2; RNF03/04/10 → Fase 3; RNF05/06 → Fase 4; RNF07/08 → Fase 6; RNF11/12 → todas (verificação contínua); RNF13/14/15 → Fase 7.

---

## §6 — Verificação (rodar ao fechar cada fase)

```bash
npm run typecheck   # tsc --noEmit, 0 erros
npm test            # 97 testes atuais + novos; cobertura ≥ 80% (jest.config.js:12-19)
npx expo-doctor     # 21/21
npx expo start      # bundle Android + manifest exposdk:57.0.0
```

---

## §7 — Registro de discrepância entre os dois documentos-fonte

`criteriosapresentacao1.md` descreve também uma trilha "estágio/relatórios" (`PeriodoAvaliacao`, `Estagio`, `TokenSupervisor`, `Criterio`, `Assinatura`, `CargaHoraria`, `StatusPeriodo`, telas `AssinaturaScreen`/`AtividadesFormScreen`/`HistoricoRelatoriosScreen`) que **não existe** na documentação do software (cujo domínio é `Animal`, `AnimalPhoto`, `Favorite`, `AdoptionInterest`, `SyncAction` — doc §§4–5). O código contém as duas trilhas e os 89 testes cobrem ambas.

**Decisão registrada:** a trilha adoção é o escopo deste planejamento. Nenhum próximo passo cria, remove ou renomeia nada da trilha estágio sem decisão explícita posterior — este arquivo apenas a documenta como legado existente.
