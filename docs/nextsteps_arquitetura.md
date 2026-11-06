# Enlace — Plano de correções de arquitetura (`nextsteps_arquitetura.md`)

> **Origem:** auditoria conduzida conforme `docs/arquitetura/README.md` + os cinco documentos temáticos (01-offline-first, 02-camera-permissoes-e-selecao, 03-captura-foto-video-e-qr, 04-tratamento-e-armazenamento-de-midia, 05-sqlite-supabase-e-seguranca) e o `06-checklist-de-revisao.md`.
>
> **Commit inspecionado:** `11cee1a`. **Evidência coletada:** inspeção de código + suíte (405/405 verdes, 62 suítes) + `supabase/init.sql`.
> **Não verificado ainda:** Supabase remoto real, aparelho físico, EXIF do arquivo enviado, permissões em build próprio.

**Regras desta revisão (README §4):**

1. Preservar funcionalidades existentes — nenhuma correção abaixo exige trocar biblioteca, adotar Drizzle/ORM externo ou reestruturar diretórios.
2. Diferenciar **regra da aula** (aplicável), **exemplo didático** (adaptar, não copiar) e **funcionalidade opcional** (vídeo, QR, álbuns, IA, reconhecimento — fora do escopo do Enlace; critérios CAP-05..08, MID-04/06/08 e DAT de vídeo são **NA**).
3. Correções pequenas e incrementais, com evidência e teste — nada de refatoração única.
4. Verificações que exigem ambiente real (policies remotas, EXIF, device) ficam **NV**, nunca marcadas como atendidas por inferência.

---

## §1 — Resumo do diagnóstico (checklist 06 por status)

| Grupo | AT | PA | AU | NA | NV |
|---|---|---|---|---|---|
| OFF (§3) | OFF-01, 03, 04, 08, 09, 10, 11 | OFF-02, 05, 06, 07 | — | — | — |
| PER (§4) | PER-01, 02, 04, 05, 07 | PER-03, 06 | — | — | — |
| CAP (§5) | — | — | — | CAP-01..08 (justificadas) | — |
| MID (§6) | MID-03, 09 | MID-01, 02, 05, 07 | — | MID-04, 06, 08 | — |
| DAT (§7) | DAT-01, 02, 03, 04, 11, 12 | DAT-05, 06, 07, 08, 09 | **DAT-10** | — | políticas remotas de DAT-05/06/07 |

**Leitura geral:** a base arquitetural é sólida e superior aos exemplos didáticos da aula (identidade UUID estável vs `Date.now()`, outbox transacional vs `sincronizado=0/1`, versionamento com bloqueio otimista vs sem controle). Os achados estão concentrados na **camada remota real** (nunca usada ainda) e em **semânticas de sincronização** que os exemplos das aulas também não cobrem.

---

## §2 — Evidências de itens AT (resumo para rastreabilidade)

- **OFF-01:** mapa offline em `src/application/offline/OfflineCapabilities.ts` (14 funcionalidades, RF/estados); E2E c/ SQLite em arquivo (`__tests__/e2e/OfflineSyncFlows.real.test.ts`).
- **OFF-03:** `Animal.id` UUID compartilhado local/remoto (`SupabaseAnimalRepository.ts:301`); `version` com bloqueio otimista (`:128` — `version = animal.version - 1` → `StaleVersionError`); `SyncMetadata.last_sync_at` (`PullRemoteAnimalsUseCase.ts:36-40`).
- **OFF-04:** `SqliteUnitOfWork.ts:8` (`withTransactionAsync`); dado + ação na mesma transação (`UpdateAnimalUseCase.ts:42-45`, padrão repetido nos use cases de favorito/interesse/exclusão/ADOPTED).
- **OFF-08:** `deleteRemote` idempotente (teste dedicado); `deleteLocal` em transação com fotos e `local_images` (`SqliteAnimalRepository.ts:167-173`).
- **OFF-09:** trava dupla (`RunFullSyncUseCase.running` + `ProcessSyncQueueUseCase.isRunning`), runner único por container (`useFullSync.ts:13-15`, `WeakMap<AppContainer, RunFullSyncUseCase>`), liberação em `finally`, auto-sync 1x/ciclo (`useAutoSync.ts:36-39`) — mesmo runner do disparo manual.
- **OFF-10:** `SyncState` + `OFFLINE_STATUS_LABELS` (RF22), tela Sync com resumo, conflitos nunca reenviados sozinhos.
- **DAT-02:** SQL 100% parametrizado nos repositórios SQLite (ex.: `SqliteAnimalRepository.ts:99-144`).
- **DAT-04:** apenas `EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY` (públicas); modo honesto → `null` (`client.ts:20-27,34-67`); zero credencial privilegiada.
- **DAT-05 (SQL):** `init.sql:158-212` — `animals` leitura pública só não-HIDDEN; dono edita/exclui o seu; `animal_photos` autorizada pelo dono do anúncio (`is_animal_owner`); favoritos/interesses privados.
- **DAT-06 (SQL):** bucket `animal-photos` com restrição `image/webp` + 2 MB; insert/update/delete restritos à pasta do dono (`foldername[1] = auth.uid()`), admin delete (`init.sql:269-303`).
- **MID-09:** limpeza de órfãos no bucket na troca de foto (commit `977a28c`), remoção de fotos órfãs por regravação em `saveLocal`.

---

## §3 — Achados e correções (modelo §9 do checklist)

### Achado 1 — Servidor não reconhece reenvio de CREATE 【P1】

- **Regras relacionadas:** OFF-05, DAT-08, DAT-09 · **Cenários:** T04, T16
- **Status/evidência:** `SupabaseAnimalRepository.createRemote:95-99` faz `.insert()` puro com `id` local estável. Timeout após o servidor gravar → retry → violação de chave única (23505) → ação entra em falha permanente, o cache local nunca marca o anúncio como sincronizado. Mesmo padrão presumido nos gateways de favoritos/interesses (verificar na implementação).
- **Impacto:** quebra a promessa de reenvio idempotente; item da fila vira "erro" apesar de o dado existir no servidor.
- **Correção proposta:** em `createRemote` (animals e os dois gateways), reconhecer item próprio já existente antes de inserir — `select` por `id` + conferência de `owner_id = sessão` (retorno como sucesso), ou `upsert { onConflict: 'id' }` (a RLS `owner_id = auth.uid()` protege contra sobrescrever terceiro). Mudança mínima, uma função por adapter.
- **Teste:** no `test-support/SupabaseFake.ts`, simular confirmação perdida (insert cravado + action ainda pendente) → 2ª execução converge sem erro; cenário T04 automatizado.
- **Dados existentes:** nenhuma migration; ação em FAILED volta a PENDING (aproveitar o retry natural do worker).

### Achado 2 — Sem isolamento de conta no banco local e na fila 【P1】

- **Regras relacionadas:** DAT-10 · **Cenário:** T19
- **Status/evidência:** `AuthContext.logout` (linhas 148-150) limpa apenas sessão. Cache SQLite e itens de `sync_queue` não sabem de quem são: pendências de A são processadas com a sessão de B (a RLS remota recusa — servidor seguro — mas o item entra em erro permanente e o trabalho de A fica sem caminho de volta); cache local de A fica buscável por B no aparelho.
- **Decisão de produto necessária antes de implementar (registrar em §4 do nextsteps):** o que acontece com dados/pendências de A ao sair da conta: (a) preservar e retomar no novo login de A, ou (b) limpar com aviso.
- **Correção proposta (aguardando decisão; parte já implementável):** tags de dono nos itens da fila (payload já tem `ownerId` em animais e `userId` em favoritos/interesses). No worker, **ignorar ações cujo dono ≠ usuário da sessão ativa** (fila continua persistida; retomam quando o dono volta). Opcional: banner-aviso no logout.
- **Teste:** T19 no fake — pendência de A, trocar para B, `execute()` não processa; voltar para A processa.
- **Dados existentes:** nenhuma migration; o item já carrega dono no payload.

### Achado 3 — Confirmação de revisão não correlaciona o que foi enviado 【P1/P2】

- **Regras relacionadas:** OFF-07, DAT-09 · **Cenário:** T07
- **Status/evidência:** `ProcessSyncQueueUseCase.applyAnimalAction:149-157` lê sempre o animal **atual** (`requireLocalAnimal`) — se o usuário editou de novo enquanto o envio anterior estava na fila, o envio da revisão vN na realidade transmite o conteúdo de vN+1, e **todas** as ações pendentes do animal acabam marcadas como concluídas sequencialmente. Sem perda de conteúdo no caminho feliz, mas contrário ao contrato "confirmar somente a revisão efetivamente enviada"; gera reenvios redundantes e churn de `StaleVersionError` quando há segunda edição em andamento. **O cenário T07 não tem teste hoje.**
- **Correção proposta:** *supersede* na fila — ao enfileirar `UPDATE` cuja entidade já tem `UPDATE`/`MARK_ADOPTED` pendente (não-em-conflito, não-syncing), substituir a ação antiga pela nova (mesma transação do outbox). Fica a revisão mais recente como único item a enviar; a antiga é removida. Complemento opcional: correlacionar confirmação por versão no `updateRemote` (payload já leva `version`).
- **Teste:** T07 — editar v2, v3 pendente de v2 em envio; confirmar que v3 sobe única e a fila fica sem item fantasma.
- **Dados existentes:** nenhuma migration; itens antigos são executados/limpos naturalmente.

### Achado 4 — UI não observa mudanças que o sync traz (P2)

- **Regras relacionadas:** OFF-02, OFF-10 · **Cenário:** T28
- **Status/evidência:** `SearchScreen.tsx:61-64` refaz a busca apenas em mount, mudança de filtro e mudança de conectividade. Após um pull bem-sucedido com a lista aberta, telas não atualizam (T28 não passa).
- **Correção proposta:** `getFullSync`/`RunFullSyncUseCase` entregar um **callback/observação leve** de pull concluído (ex.: evento no contexto de repositórios → reexecutar a última busca). Sem `useLiveQuery`/Drizzle — manter SQL cru (decisão de ORM já registrada em `decisao-orm.md`).
- **Teste:** T28 — lista aberta, sync remoto entra, tela reflete sem remount manual.

### Achado 5 — Falha de cópia do arquivo é silenciada 【P2】

- **Regras relacionadas:** MID-02, OFF-10 · **Cenário:** T15
- **Status/evidência:** `SqlitePhotoStorage.copyToAppStorage:150-154` — o `catch` devolve a URI temporária original; `local_images` passa a referenciar um arquivo de cache que morre ao encerrar o app (falsa promessa de durabilidade). No Jest/demo o comportamento é desejável; em device não.
- **Correção proposta:** distinguir ambiente — com cópia habilitada (device), lançar erro específico (`PhotoCopyError`); só nos ambientes de teste/demo o fallback atual permanece. A UI já trata erro de `persistLocal` (feedback visível).
- **Teste:** T15 — cópia interrompida → sem linha "persistida" apontando para cache; aviso exibido.

### Achado 6 — Verificações que dependem de ambiente real 【P3 — já mapeadas】

- Regras: PER-03 (build próprio), DAT-05/06/07 remoto (T18/T20), MID-01 (T14 medição), MID-07 (T22 EXIF), DAT-10 real (T19 em device), OFF-02 migração real (T02 no aparelho).
- Antes de marcar qualquer um como atendido: aplicar `supabase/init.sql` num projeto real, configurar `EXPO_PUBLIC_*`, e rodar a validação em device (Fase B/C do plano anterior — não duplicar aqui, apenas apontar).

---

## §4 — Ordem de execução (adaptando §10 do checklist)

> **Legenda de status (atualizada a cada sessão):**
> ✅ implementado · 🔒 **Aguardando decisão do responsável** — não implementar sem a escolha · ⏳ pendente de implementação (sem bloqueio) · 🌐 pendente de ambiente real (projeto Supabase + aparelho)

| Ordem | Tarefa | Regras | Escopo do código | Bloqueio |
|---|---|---|---|---|
| 0 🔒 | **Decidir política DAT-10** (preservar vs limpar dados de A na troca de conta) | DAT-10 | somente doc | **🔒 decisão de produto — escolher:** (a) preservar e retomar no novo login de A, ou (b) limpar com aviso no logout |
| 1 ✅ | Reenvio de CREATE reconhecido (animals + favoritos + interesses) | OFF-05, DAT-08 | `SupabaseAnimalRepository.ts`, `SupabaseUserDataGateways.ts`, `SupabaseFake.ts` | — |
| 2 🔒 | Worker ignora ações de outra conta (tag de dono + filtro por sessão) | DAT-10 | `ProcessSyncQueueUseCase.ts`, `SyncAction.ts` | **🔒 depende da ordem 0** (a política define o que fazer com o item: pausar vs limpar) |
| 3 ✅ | Supersede de UPDATE pendente + teste T07 | OFF-07, DAT-09 | `UpdateAnimalUseCase.ts` (enqueue), `ProcessSyncQueueUseCase.ts` | — |
| 4 ✅ | Re-consulta de listas após pull | OFF-02 | `RunFullSyncUseCase.ts`, `SearchScreen.tsx`, contexto | — |
| 5 ✅ | Erro explícito na falha de cópia em device | MID-02 | `SqlitePhotoStorage.ts:150-154` | — |
| 6 🔒 | Documentar decisão OFF-06 (snapshot integral em vez de cursor delta) | OFF-06 | doc | **🔒 decisão de produto leve — confirmar:** snapshot integral é aceitável para o escopo (não implementar cursor/delta sem necessidade demonstrada) |
| 7 ✅ | Backoff com espaçamento entre tentativas + classificação permanente/transitória | OFF-05, DAT-11 | `ProcessSyncQueueUseCase.ts`, `SincronizacaoService.ts` | — |
| 8 🌐 | Validações de ambiente real (init.sql + EXPO_PUBLIC_* + device: T10/T18/T20/T22) | PER-03, DAT-05..07, MID-01/07 | ambiente | **🌐 requer:** criar projeto Supabase + aparelho físico (ação fora do código) |

**Itens 1–5** são tarefas incrementais independentes: cada um é commitável por conta própria, com suíte verde. Não promover refatoração única.

> **Progresso:** **TODAS as ordens sem decisão de produto foram implementadas** (1, 3, 4, 5, 7 ✅). Itens 🔒 (0, 2, 6) aguardam decisão do responsável; item 🌐 (8) aguarda ambiente real (projeto Supabase + aparelho).

---

## §5 — Cenários de validação (mapeamento dos testes T01–T28 do checklist)

| Cenário | Status atual | Como validar |
|---|---|---|
| T01, T03, T04*, T06, T09, T11, T12*, T13, T15* | coberto parcialmente por testes com fake/TDD | confirmar os marcados * depois da correção (T04 no achado 1; T15 no achado 5) |
| T02 | **AT** (migrações testadas) | device: revisar com banco v1 → v2 |
| T05, T07, T16, T19, T28 | **sem teste** | corrigir primeiro (achados 1, 2, 3, 4), depois escrever o teste |
| T08 | **AT** (delete idempotente + fila) | ambiente real ancora em T08 remoto |
| T10, T14, T17, T18, T20, T21, T22 | **NV** | device + projeto Supabase real (ordem 8) |
| T23–T26 | **NA** | vídeo/QR/galeria/IA fora de escopo |
| T27 | **AT** (SQL parametrizado) | incluir caso de teste de título com apóstrofo, se ausente |

---

## §6 — Registro de escopo e o que NÃO será feito

- **Não instalar** Drizzle/ORM, PowerSync/ElectricSQL, SQLCipher, expo-camera, expo-media-library, expo-video (NA ou decisão de arquitetura posterior, mediante necessidade demonstrada — doc 01 §5, README §3).
- **Não implementar** delta/cursor, CRDT, upload resumível, vídeo, QR, álbuns, IA/OCR/reconhecimento — fora do escopo atual.
- **Não trocar** nomes/arquivos existentes para "casar" com nomes conceituais dos PDFs.
- **Não apagar** banco, fila ou arquivos pendentes para corrigir estados.
- Recursos opcionais só entram por decisão de produto registrada (regra §4 do nextsteps).

---

## §7 — Encerramento da revisão

- **Corrigido com evidência:**
  - ✅ **Ordem 1** — commit `f7caf44`: `createRemote` converte 23505 do próprio id (re-leitura segura pela RLS) e `SupabaseFake` simula a violação de PK; favoritos/interesses já eram idempotentes e têm confirmação por testes. Testes: reenvio T04 (2 casos) em `SupabaseAnimalRepository.test.ts`.
  - ✅ **Ordem 3** — commit `f7caf44`: port `enqueueAnimalUpdate` (supersede de UPDATE/MARK_ADOPTED do mesmo animal; conflito e CREATE preservados), usado por `UpdateAnimalUseCase` e `MarkAnimalAdoptedUseCase`; filtro em TypeScript para comportamento idêntico em todos os drivers. Testes: `UpdateSupersede.test.ts` (4 casos, incluindo T07 e preservação de conflito) + teste SQL do branch (`SqliteSyncQueueRepository.test.ts`).
  - Estado da suíte após as ordens 1+3: **412/412 verdes (63 suítes)**, typecheck 0 erros.
  - ✅ **Ordem 4** — commit `280924d`: evento leve de adapters (`src/adapters/sync/pullEvents.ts`); `PullNotifyingFullSync` (in `useFullSync.ts`) notifica quando o pull conclui — falha de pull e modo honesto (sem backend) não notificam; `SearchScreen` refaz a última consulta via pulso no `useEffect` (sem stale closure). A camada application permanece pura. Testes: `PullEvents.test.ts` (4 casos, T28 no ciclo) + `SearchScreenSyncRefresh.test.tsx` (T28 na tela).
  - ✅ **Ordem 5** — commit `3242c42`: com FileSystem operante (device), falha de cópia lança `PhotoCopyError` e **nenhuma** linha entra em `local_images` (antes: URI temporária da câmera/galeria registrada em silêncio → cache offline apontando para arquivo condenado). Degradação segura mantida onde não há armazenamento operante (testes/demo headless). Testes: `SqlitePhotoStorage.test.ts` (2 casos; teste pre-existente de degradação intacto).
  - Estado da suíte após as ordens 1–5 (exceto 7): **419/419 verdes (65 suítes)**, typecheck 0 erros.
  - ✅ **Ordem 7** — commit `5266da0`: falha TRANSITÓRIA (rede) NÃO reenvia no ciclo seguinte — espera o backoff crescente (2s, 4s … cap 30s, contado da ÚLTIMA falha: `changedAt` é regravado em `markFailed` e persistido pelo `update` do repositório SQLite). Falha PERMANENTE (operação não suportada, anúncio apagado localmente, sem backend) NUNCA reenvia — marcada com prefixo `[ERRO PERMANENTE]` em `last_error` (sobrevive a reinício sem coluna nova; mesmo padrão do marcador `[CONFLITO]` RF23). Testes: `SyncRetrySpacing.test.ts` (8 casos: backoff/retryIsDue, permanente sem reenvio após 1 min, tentativas esgotadas) + `changed_at` persistido (`SqliteSyncQueueRepository.test.ts`).
  - Estado final da suíte (ordens sem decisão concluídas): **428/428 verdes (66 suítes)**, typecheck 0 erros.
- **Explicitamente pendente:** ordens 🔒 (0, 2, 6 — decisão do responsável) e 🌐 (8 — ambiente real).
- **Limitações registradas:** políticas RLS não aplicadas a servidor real; EXIF não inspecionado; permissões não testadas em build próprio; nenhum cenário de device executado.
- Atualizar este arquivo a cada correção (o que foi comprovado, o que mudou e o que permanece NV) — o checklist 06 continua sendo o registro por regra.
