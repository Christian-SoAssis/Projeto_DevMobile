# Next Steps — Adequação à Estrutura de Arquitetura

**Projeto:** Enlace — Rede de Adoção de Animais  
**Referências:**  
- `docs/criteriosapresentacao1.md` (exemplo de arquitetura prescrito pelo professor)  
- `docs/arquitetura/` (adaptação dos PDFs das aulas do professor: 01-offline-first, 02-camera, 03-captura, 04-midia, 05-sqlite-supabase-seguranca, 06-checklist-de-revisao)  
**Contexto:** O projeto foi refeito. A apresentação anterior foi feita sobre uma versão anterior; agora precisamos confirmar que esta nova versão atende aos princípios arquiteturais prescritos. A fase de 100% mock **não é mais necessária** — o Enlace já está integrado com SQLite real (`expo-sqlite`) e Supabase real.

---

## 1. Princípios Arquiteturais a Aplicar

### 1.1 Do `criteriosapresentacao1.md`

| Princípio | Aplicação no Enlace |
|---|---|
| **Camada de domínio 100% pura** — sem importar React, Expo, bibliotecas de UI ou banco de dados | `src/domain/` deve continuar sem dependências de infraestrutura (Expo, Supabase, SQLite, UI). |
| **Value Objects imutáveis, validados na criação** | `AnimalCharacteristics`, `ApproximateLocation`, `SearchRadius`, `AdoptionStatus`, `SyncState` devem seguir esse padrão. |
| **Contratos/Interfaces no domínio** | `src/domain/ports/` (repositórios, gateways) definem a fronteira; nenhuma implementação concreta vaza para o domínio. |
| **Camada de aplicação orquestra via interfaces** | Use cases em `src/application/use-cases/` chamam entidades e portas, sem regras de negócio puras nem código de interface. |
| **Adapters isolam hardware e serviços externos** | Câmera, localização, conectividade, armazenamento seguro, SQLite e Supabase ficam atrás de interfaces declaradas no domínio. |
| **Context API na camada de adapters/UI** | `AuthContext` e `RepositoriesContext` ficam em `src/adapters/context/`; domínio e aplicação nunca importam a Context API. |
| **Custom hooks como ponte** | Hooks em `src/adapters/hooks/` adaptam use cases ao ciclo de vida do React Native (estados de carregamento, salvando, salvo). |
| **Expo Router como fronteira de entrada visual** | Rotas em `app/` (públicas, tabs, protegidas) são o boundary; telas usam `<View>`, `<Text>`, `StyleSheet`, Flexbox. |
| **Fase mock superada** | Não há mais necessidade de manter repositórios, sessão ou hardware em fake/mock. SQLite e Supabase são reais. |

### 1.2 Dos documentos em `docs/arquitetura/` (teoria das aulas)

| Fonte | Princípio essencial | Aplicação ao Enlace |
|---|---|---|
| **01-offline-first** | O banco local alimenta a interface; servidor valida e autoriza remotamente; "salvo no aparelho" ≠ "publicado no servidor" | SQLite local é base operacional; fila de sync reconcilia com Supabase; estados locais e remotos são distintos. |
| **01-offline-first (OFF-04)** | Dado e operação pendente na mesma transação atômica | `SqliteUnitOfWork` deve garantir atomicidade entre anúncio/foto e item da fila. |
| **01-offline-first (OFF-06)** | Delta sync com cursor; lote + cursor na mesma transação; relógio do servidor como autoridade | `PullRemoteAnimalsUseCase` com cursor `(updated_at, id)`; triggers de `updated_at` no servidor. |
| **01-offline-first (OFF-07)** | Política de conflito explícita; não confirmar revisão nova indevidamente | `ConflictResolutionService` com last-write wins automático e revisão manual para divergência de status. |
| **01-offline-first (OFF-08)** | Soft delete + tombstones; retenção; não ressuscitar excluídos | Tabela `animal_tombstones` (DELETED/HIDDEN) mantida por trigger no Supabase e no SQLite. |
| **01-offline-first (OFF-09)** | Gatilhos coordenados (reconexão, foreground, escrita local, manual); sem execuções concorrentes | `AutoSync` + `RunFullSyncUseCase` com trava `runningPromise`; `useAutoSync`. |
| **01-offline-first (OFF-10)** | UI distingue salvo localmente / pendente / sincronizado / erro | `SyncScreen`, badge de notificações, chip "Salvo no aparelho". |
| **02-camera-permissoes-e-selecao** | Permissão no contexto correto; não bloquear app se negada; ImagePicker vs CameraView | `ImagePickerCameraAdapter`; permissões no `app.json`; galeria como alternativa à câmera. |
| **03-captura-foto-video-e-qr** | Vídeo e QR não devem ser adicionados só porque estão na aula | Não estão no escopo do Enlace (marcar como NA se confirmado). |
| **04-tratamento-e-armazenamento-de-midia** | Separar arquivo físico de metadados; SQLite guarda referências, não binários grandes | `animal_photos` com `local_path`, `remote_url`, `upload_status`; `WebpPhotoStorage` + `ExpoImageManipulatorAdapter`. |
| **05-sqlite-supabase-e-seguranca** | RLS por operação e visibilidade; políticas de Storage; segredos fora do cliente; identidade estável para reenvio | Políticas RLS no `init.sql`; bucket `animal-photos`; `EXPO_PUBLIC_*` apenas no cliente; UUIDs estáveis. |
| **05-sqlite-supabase-e-seguranca (DAT-10)** | Troca de conta isola rascunhos, arquivos privados e pendências | `ownerId` no payload do `SyncAction`; worker pausa ações de outra conta; teste DAT-10 executado. |
| **06-checklist-de-revisao** | Auditoria por evidência; status AT/PA/AU/NA/NV; prioridades P0-P3 | Usar para classificar cada item com arquivo/função/migration/teste citados. |

---

## 2. Estado Atual do Projeto (já implementado)

O que já está conforme a arquitetura prescrita:

- **Domínio puro:** `src/domain/entities/`, `src/domain/value-objects/`, `src/domain/ports/`, `src/domain/services/` estão implementados e sem dependências de infraestrutura.
- **Use cases:** 14 use cases em `src/application/use-cases/` (busca, criar/editar/excluir anúncio, marcar adotado, favoritar, interesse, sincronização, conflito, moderação).
- **Adapters de hardware:** `CameraGateway`, `LocationGateway`, `ConnectivityGateway` definidos no domínio e implementados em `src/infrastructure/device/`.
- **Context API:** `AuthContext.tsx` e `RepositoriesContext.tsx` em `src/adapters/context/`.
- **Custom hooks:** `useAuth`, `useConnectivity`, `useFullSync`, `useAutoSync` em `src/adapters/hooks/`.
- **Interface e rotas:** Expo Router estruturado em `app/(public)/`, `app/(tabs)/`, `app/(protected)/`, `app/animal/`; telas com `<View>`, `<Text>`, `StyleSheet`.
- **Infraestrutura real:** SQLite (`expo-sqlite`) com migrations em `src/infrastructure/database/sqlite/`; Supabase (client, auth, repositories, storage) em `src/infrastructure/supabase/`.
- **Qualidade de código:** `tsc --noEmit` limpo (TypeScript strict). Testes de domínio passando (`src/__tests__/enlace.test.ts`, 7 testes).
- **DAT-10 (isolamento entre contas):** implementado e testado (`enlace.test.ts`).

---

## 3. Matriz de Critérios da Teoria vs. Implementação

Extraída de `docs/arquitetura/06-checklist-de-revisao.md`. Status: **AT** = Atendido, **PA** = Parcial, **AU** = Ausente, **NA** = Não aplicável, **NV** = Não verificado.

### 3.1 Persistência e Sincronização (OFF)

| ID | Critério | Status | Evidência / Justificativa |
|---|---|---|---|
| OFF-01 | Contrato offline definido; leitura/escrita local persistem sem rede | PA | SQLite local, novo-anuncio/editar-anuncio funcionam offline; não testado em cenário de avião + fechar/reabrir |
| OFF-02 | Migrations preservam dados e pendências; mudanças do sync chegam à UI | PA | `migrations.ts` com `CREATE TABLE IF NOT EXISTS`; não há versionamento de migrations para evolução de schema |
| OFF-03 | Identificadores globais e metadados de sync permitem reconhecer o mesmo registro no reenvio | PA | UUID, updated_at, version, sync_queue existem; não testado em dois aparelhos simultâneos |
| OFF-04 | Dado e operação pendente são persistidos atomicamente, com dependências respeitadas | PA | `SqliteUnitOfWork` existe; não testado interrupção de gravação no meio da transação |
| OFF-05 | Servidor reconhece reenvios; retry adequado; sem duplicação | PA | `SyncAction` com `attempts`, `status`, `lastError`; não há backoff exponencial explícito; idempotência remota não testada contra servidor real |
| OFF-06 | Lote e cursor são consistentes; estratégia de recebimento equivalente justificada | PA | `listVisibleChangedAfter` com cursor `(updated_at, id)`; triggers/índice do `init.sql` não aplicados em servidor real (pendente de verificação remota) |
| OFF-07 | Conflitos e edições durante envio têm regra; sem confirmação indevida de revisão nova | PA | `ConflictResolutionService`, `ResolveSyncConflictUseCase`, tela `conflito/[id]`; não testado em dois aparelhos |
| OFF-08 | Exclusões propagam; tombstones não removidos cedo demais | PA | `animal_tombstones` (DELETED/HIDDEN) por trigger; cliente remove do cache exceto quando há ação pendente; SQL não aplicado em servidor real |
| OFF-09 | Gatilhos coordenados; falhas não deixam worker travado | NV | `AutoSync` + `RunFullSyncUseCase` com trava; não testado reconexão + botão manual simultâneo |
| OFF-10 | UI distingue salvo localmente / pendente / sincronizado / erro | NV | `SyncScreen`, badge, chip "Salvo no aparelho"; não testado estados coerentes em ausência de rede, falha permanente, nova tentativa |
| OFF-11 | Estratégia adequada por tipo de dado; sem rastreamento ou vídeo desnecessários | NV | Localização pontual, CRUD via outbox, mídia com fila de upload; não testado se corresponde ao dado real sem excessos |

### 3.2 Permissões e Seleção (PER)

| ID | Critério | Status | Evidência / Justificativa |
|---|---|---|---|
| PER-01 | Permissão solicitada no contexto correto; não bloqueia app se negada | NV | `ImagePickerCameraAdapter`; permissões no `app.json`; não testado instalação nova + negação |
| PER-02 | Carregamento, negação, impossibilidade de perguntar, retorno de configurações tratados | NV | `handleUseMyLocation` trata erro de localização; não testado fluxo completo de permissão |
| PER-03 | Configuração nativa e mensagens correspondem aos recursos e build testado | NV | Plugins no `app.json`; não verificado em build distribuído |
| PER-04 | ImagePicker/CameraView escolhidos conforme requisito; ação anunciada executada | NV | `ImagePickerCameraAdapter`; não testado em dispositivo físico |
| PER-05 | Cancelamento, assets ausentes, resultados inválidos não geram erros nem registros vazios | NV | Verifica `res?.uri` antes de usar; não testado cancelar preservando foto anterior |
| PER-06 | Tipos, quantidade, opções de seleção coerentes com produto e plataforma | NV | Limite de 4 fotos; não testado selecionar múltiplos, atingir limite, tipo não aceito |
| PER-07 | Exibir URI temporária é distinto de salvar persistentemente | NV | `SqlitePhotoStorage` persiste caminhos locais; não testado salvar/encerrar/reabrir mantendo referência válida |

### 3.3 Captura, Vídeo e Códigos (CAP)

| ID | Critério | Status | Evidência / Justificativa |
|---|---|---|---|
| CAP-01 | Câmera desmonta quando tela/app não precisa dela | NA | Projeto usa ImagePicker, não CameraView próprio |
| CAP-02 | Permissão, layout, prontidão, falhas de montagem tratados antes da ação | NV | Implementado parcialmente; não testado |
| CAP-03 | Capturas simultâneas impedidas; falhas liberam estado de captura | NA | ImagePicker é síncrono por fluxo; não há CameraView próprio |
| CAP-04 | Refazer/cancelar/aceitar foto não apaga trabalho nem cria uploads fantasmas | NV | `removePhoto`, filtro de fotos; não testado sequências |
| CAP-05 a CAP-08 | Vídeo, QR, códigos de barras | NA | Não estão no escopo do Enlace |

### 3.4 Tratamento e Arquivos (MID)

| ID | Critério | Status | Evidência / Justificativa |
|---|---|---|---|
| MID-01 | Tratamento/compressão medidos; MIME/extensão/bytes coerentes | NV | `ExpoImageManipulatorAdapter`, `WebpPhotoStorage`; não testado redução medida, qualidade visual, coerência MIME |
| MID-02 | Arquivo sai do cache temporário; falhas entre filesystem e banco recuperáveis | NV | `SqlitePhotoStorage` persiste localmente; não testado interromper app e reabrir |
| MID-03 | Banco guarda referências e estados válidos; sem binários grandes/base64 | NV | `animal_photos` com `local_path`, `remote_url`, `upload_status`; não testado metadados apontam para arquivo certo |
| MID-04 | Exportação/álbum/listagem de galeria com permissões e limites | NA | Não é escopo do Enlace |
| MID-05 | Listas usam mídia adequada ao tamanho; tratam ausência/expiração | NV | `FALLBACK_PHOTO` para URIs ausentes; não testado URL expirada renovada / offline com cópia local |
| MID-06 | Vídeo com limites e upload resumível | NA | Não está no escopo |
| MID-07 | EXIF e localização enviados correspondem à finalidade/visibilidade | NV | Localização aproximada, não exibe endereço exato; não testado inspecionar EXIF do arquivo final |
| MID-08 | Reconhecimento de imagem atrás de backend seguro | NA | Não está no escopo |
| MID-09 | Limpeza, cancelamento, falta de espaço, progresso preservam arquivos necessários | NV | Não há rotina de limpeza explícita |

### 3.5 SQLite, Supabase e Segurança (DAT)

| ID | Critério | Status | Evidência / Justificativa |
|---|---|---|---|
| DAT-01 | Conexão/schema com ciclo de vida definido; não depende só de `CREATE IF NOT EXISTS` | PA | `DatabaseDriver`, `applyMigrations`, `getDatabaseDriver`; `CREATE TABLE IF NOT EXISTS` sozinho não evolui schema antigo |
| DAT-02 | SQL usa parâmetros, sem interpolação insegura | NV | `InMemorySqliteDriver` e `ExpoSqliteDriver` usam parâmetros; não testado título com apóstrofo / entrada semelhante a SQL |
| DAT-03 | Sessão inicial, expirada, ausente tratadas sem perder pendências | NV | `SupabaseAuthGateway`, `createSessionStorage`; não testado expiração durante sync |
| DAT-04 | Sem credenciais privilegiadas no cliente/configuração/logs | NV | `.env.example` com placeholders; `.env.local` no `.gitignore`; não verificado bundle/logs |
| DAT-05 | RLS distingue leitura pública/privada e operações do dono; vínculos autorizados | NV | Políticas RLS no `init.sql`; não verificadas em servidor real |
| DAT-06 | Políticas do Storage protegem bucket, caminhos, operações | NV | Bucket `animal-photos` público no `init.sql`; não verificado em servidor real |
| DAT-07 | Referência estável separada da URL; URL assinada expira e é renovada | NV | `storage_path` + `public_or_signed_url` no schema; não testado |
| DAT-08 | Upload com identidade estável; corpo/formato compatíveis; reenvio sem duplicação | NV | `SupabasePhotoStorage.uploadPending`, `SupabaseAnimalRepository.syncRemotePhotos`; não testado contra servidor real |
| DAT-09 | Sucessos parciais retomados; só revisão completamente enviada é confirmada | NV | Estados de `SyncAction`, `SyncState`; não testado |
| DAT-10 | Troca de conta isola rascunhos, arquivos privados, pendências | **AT** | `ownerId` no payload; worker pausa ações de outra conta; teste executado em `enlace.test.ts` |
| DAT-11 | Worker, listeners, dependências, classificação de erros permitem novas tentativas | NV | `AutoSync`, `RunFullSyncUseCase` com trava; não testado falha sem travar worker permanentemente |
| DAT-12 | Exclusões coordenam linha/arquivo; não ressuscitar nem apagar mídia referenciada | NV | Trigger `sync_animal_tombstones` no `init.sql`; não testado em servidor real |

---

## 4. O que Falta — Próximos Passos

Os itens abaixo estão organizados em ordem sequencial de construção, seguindo a lógica dos documentos `criteriosapresentacao1.md` e `docs/arquitetura/`, considerando que a fase mock já foi superada e que aplicar o `init.sql` em servidor Supabase real (verificação remota de RLS, Storage, triggers, tombstones) já está feito e fica de fora deste escopo imediato.

### 4.1. Preencher o check-list de revisão da arquitetura (base para todo o restante)

- [ ] Preencher `docs/arquitetura/06-checklist-de-revisao.md` com evidências de código para cada ID (OFF-01 a OFF-11, PER-01 a PER-07, CAP-01 a CAP-08, MID-01 a MID-09, DAT-01 a DAT-12), citando arquivos, funções, migrations e testes.
- [ ] Classificar cada item como AT / PA / AU / NA / NV com nível de verificação (inspeção local / teste executado / remoto verificado).

### 4.2. Revisar e consolidar a camada de domínio ✅ CONCLUÍDO

- [x] Confirmar que `src/domain/` não importa nenhuma biblioteca de Expo, React Native, Supabase ou SQLite. (verificado via grep — zero matches)
- [x] Validar que todos os Value Objects são imutáveis e se validam na criação (`AnimalCharacteristics`, `ApproximateLocation`, `SearchRadius` com limite 10 km, `AdoptionStatus`, `SyncState`).
- [x] Confirmar que as interfaces em `src/domain/ports/` são puramente declarativas. (verificado via grep — importam apenas de entidades/value objects do próprio domínio)

### 4.3. Revisar e consolidar a camada de aplicação ✅ CONCLUÍDO

- [x] Confirmar que os 14 use cases em `src/application/use-cases/` orquestram via portas e não contêm regras de negócio puras nem código de interface.
- [x] Validar o `UnitOfWork` em `src/application/ports/UnitOfWork.ts` para consistência transacional entre SQLite e fila de sincronização (OFF-04). (implementado; teste de interrupção ainda pendente — OFF-04 classificado como PA)

### 4.4. Implementar a camada de testes (FALTANDO — prioridade alta)

A pirâmide prescrita exige 80%+ de cobertura. Atualmente só existem testes de domínio (7 testes em 1 arquivo).

- [ ] **Testes de Use Cases:** Criar testes com fakes/repositórios in-memory para cada use case (caminho feliz, tratamento de erros, falta de permissões). Exemplo: `CreateAnimalUseCase`, `SearchAnimalsUseCase`, `ToggleFavoriteUseCase`, `RegisterAdoptionInterestUseCase`, `ProcessSyncQueueUseCase`, `ResolveSyncConflictUseCase`.
- [ ] **Testes de Context API & Hooks:** Validar `AuthProvider`, `useAuth`, `RepositoriesContext` e hooks de ponte (`useConnectivity`, `useFullSync`).
- [ ] **Testes de Telas e Componentes:** Configurar `@testing-library/react-native` (RNTL) e escrever testes que simulem ações do usuário (`fireEvent.press`, `fireEvent.changeText`) nas telas envolvidas por `<AuthProvider>` e injetadas com use cases fakes.
- [ ] **Testes de Infraestrutura (SQLite):** Validar migrations (criação de todas as tabelas), persistência de cache após reinício, transações entre anúncio e ação da fila de sincronização (OFF-04, OFF-02, DAT-01).
- [ ] **Testes de Infraestrutura (Supabase):** Validar gateways com mock (RLS, leitura pública de anúncios ativos, bloqueio de edição por terceiro, proteção de favoritos e interesses, upload de fotos associado ao anúncio correto, controle de versão em atualização concorrente).
- [ ] **Testes E2E (pouquíssimos, fluxos críticos):** Reservar para fluxos completos: visitante pesquisa e abre animal; usuário autentica e favorita; responsável cria anúncio online e offline; sincronização; edição offline; fluxo de conflito; marcar adotado; bloqueio de edição de anúncio de terceiro.

### 4.5. Testes específicos dos critérios não verificados (docs/arquitetura)

Os seguintes cenários de validação (extraídos de `docs/arquitetura/06-checklist-de-revisao.md`, seção 8) devem ser implementados como testes:

| Cenário | Critérios relacionados | O que validar |
|---|---|---|
| T01 | OFF-01, OFF-10, MID-02 | Sem internet, criar/editar anúncio; fechar e reabrir; dados e fotos reaparecem; estado remoto pendente |
| T02 | OFF-02, DAT-01 | Salvar dados e pendências; atualizar com migration; dados preservados, schema atualizado |
| T03 | OFF-04 | Interromper gravação local antes da confirmação; não existe dado confirmado sem pendência |
| T04 | OFF-03, OFF-05, DAT-08 | Servidor aceita mutação; resposta perdida; reenviar; um único resultado lógico |
| T05 | OFF-06 | Falhar ao aplicar item de lote de pull; reiniciar; cursor não pula lote incompleto |
| T06 | OFF-07 | Editar mesmo anúncio em dois aparelhos; sincronizar; política de conflito observável |
| T07 | OFF-07, DAT-09 | Alterar descrição/foto enquanto revisão anterior em envio; confirmar antiga não elimina pendência da nova |
| T08 | OFF-08, DAT-12 | Excluir em A; B offline e depois sincroniza; item não reaparece |
| T09 | OFF-09, DAT-11 | Reconexão e sincronização manual juntas; falha no worker; sem processamento duplicado |
| T10 | PER-01, PER-02, PER-03 | Negar câmera, negar permanentemente, conceder nas configurações, voltar; mensagens corretas, formulário preservado |
| T11 | PER-05, PER-06 | Cancelar seletor; asset inválido; selecionar múltiplos no limite; nenhum registro vazio |
| T12 | CAP-01, CAP-02, CAP-03 | Abrir câmera, navegar, background, retornar; tocar rapidamente; uma captura por vez |
| T13 | CAP-04, PER-07 | Capturar, refazer, aceitar, cancelar; apenas mídias confirmadas persistem |
| T14 | MID-01, DAT-08 | Fotos com orientações/dimensões/formatos diferentes; saída visual correta, tamanho medido, MIME compatível |
| T15 | MID-02, MID-03, MID-09 | Após salvar, remover cache temporário; simular falta de espaço/cópia interrompida; arquivos persistentes válidos |
| T16 | DAT-08, DAT-09 | Confirmar upload e falhar ao gravar metadados; tentar novamente; reutiliza arquivo remoto sem duplicar |
| T17 | DAT-03, DAT-11 | Expirar sessão durante sync; repetir após autenticação válida; trabalho preservado com conta correta |
| T18 | DAT-05, DAT-06 | Como A, tentar ler/alterar dados privados e arquivos de B; usuário não autenticado; acesso negado onde privado |
| T19 | DAT-10 | A cria pendência offline; troca para B; retorna para A; B não vê nem envia pendência de A (já testado) |
| T20 | DAT-07, MID-05 | Expirar URL assinada; abrir foto online e offline; renovação autorizada online; cópia local offline |
| T21 | DAT-12, MID-09 | Remover foto com falha no banco ou Storage; nova tentativa/limpeza; remoção converge sem afetar outros arquivos |
| T22 | MID-07, OFF-11 | Inspecionar EXIF do arquivo final; comparar com localização pública; só dados pretendidos expostos |
| T27 | DAT-02 | Gravar título com apóstrofo e entrada semelhante a SQL; conteúdo tratado como dado |

### 4.6. Adequar o adapter de sessão segura (recomendado)

- [ ] Avaliar extrair um adapter isolado de sessão segura (`src/adapters/auth/SessionStorageSecureStore.ts`) que encapsule `expo-secure-store`, facilitando testes e desacoplando do cliente Supabase.

### 4.7. Preparar builds nativas (necessário para testes em dispositivo real)

- [ ] Executar `npx expo prebuild` (ou criar development build via EAS) para gerar projetos nativos `android/` e `ios/`.
- [ ] Testar em dispositivo/emulador: câmera, galeria, permissão de localização, `expo-secure-store` e `expo-sqlite` persistente.

### 4.8. Implementar CI/CD (recomendado)

- [ ] Adicionar GitHub Actions que rode no push/PR: `npm run typecheck`, `npm test` (Jest) e lint (se configurado).

### 4.9. Versionamento de migrations (OFF-02, DAT-01)

- [ ] Substituir `CREATE TABLE IF NOT EXISTS` único por migrations versionadas que permitam evolução de schema sem perder dados existentes.

---

## 5. Estratégia de Testes e Cobertura (meta 80%+)

Seguindo a pirâmide prescrita nos documentos:

1. **Testes de Domínio (maior volume):** já existentes; manter e expandir para novos value objects e entidades.
2. **Testes de Use Cases (volume alto):** implementar com fakes in-memory via TDD (Red-Green-Refactor).
3. **Testes de Context API & Hooks (volume médio):** `AuthProvider`, `useAuth`, `useConnectivity`, `useFullSync`.
4. **Testes de Telas e Componentes (RNTL + jest-expo):** simular interações do usuário nas telas principais.
5. **Testes de Infraestrutura (SQLite e Supabase):** migrations, RLS, Storage, upload, sincronização, conflitos.
6. **Testes E2E (pouquíssimos):** fluxos críticos completos (T01 a T27 selecionados).

---

## 6. Critérios de Conclusão (Definição de Pronto)

Considerar esta etapa concluída quando:

- [x] `tsc --noEmit` continua limpo (TypeScript strict). (verificado — sem erros)
- [x] `docs/arquitetura/06-checklist-de-revisao.md` preenchido com evidências para cada ID. (33 regras classificadas: AT/PA/AU/NA/NV)
- [ ] Suíte de testes Jest passa com cobertura ampliada (alvo: 80%+ nas camadas de domínio, aplicação e adapters críticos).
- [ ] Existem testes de use cases com fakes in-memory para os principais fluxos.
- [ ] Existem testes de telas/componentes com RNTL para as telas principais.
- [ ] Existem testes de integração para os critérios não verificados (OFF-04, OFF-05, OFF-07, OFF-08, OFF-09, OFF-10, DAT-02, DAT-03, DAT-08, DAT-09, DAT-11, DAT-12).
- [ ] Builds nativas (`android/` e `ios/`) geradas e testadas em dispositivo para câmera, localização e armazenamento seguro.
- [ ] CI configurada executando typecheck e testes em cada push/PR.
- [ ] A camada de domínio continua pura (sem importações de Expo/Supabase/SQLite/UI).

---

## 7. Prioridades e Registro de Achados

Extraído de `docs/arquitetura/06-checklist-de-revisao.md` (seções 1.3 e 9):

### Prioridades sugeridas, após demonstrar a falha

- **P0:** acesso indevido, segredo exposto ou perda/corrupção de dados comprovada; tratar antes de publicar.
- **P1:** falha em fluxo principal, duplicação, sincronização sem recuperação ou promessa offline descumprida.
- **P2:** desempenho, experiência de uso, clareza de estados e manutenção sem falha crítica imediata.
- **P3:** melhoria opcional ou futura que depende de necessidade ainda não confirmada.

### Modelo de registro de achado (para cada problema demonstrado)

```markdown
### Achado: [descrição concreta]

- Regras relacionadas: [IDs, ex.: OFF-07, DAT-05]
- Status: [PA/AU/NV, conforme evidência]
- Prioridade: [P0/P1/P2/P3 e motivo]
- Evidência: [arquivo, função, migration/política, teste e ambiente]
- Nível de verificação: [inspeção local / teste executado / remoto verificado]
- Como reproduzir: [passos]
- Comportamento observado: [resultado real]
- Comportamento esperado: [contrato aplicável]
- Impacto: [dados/usuário afetados]
- Correção proposta: [mudança mínima suficiente]
- Dados existentes: [migration, compatibilidade e recuperação necessárias]
- Validação após correção: [cenários e resultados]
- Limitações: [o que não foi possível comprovar]
```

---

## 8. Nota sobre a Fase Mock

Conforme o contexto informado, a fase de 100% mock **não é mais necessária**. O Enlace já está integrado com banco real (SQLite local + Supabase remoto). Portanto, os próximos passos focam em **consolidar testes, qualidade e builds nativas**, e não em retornar a mocks.

A verificação remota de `init.sql` em servidor Supabase real (RLS, políticas de Storage, triggers, tombstones) foi informada como já feita e fica de fora deste escopo imediato.
