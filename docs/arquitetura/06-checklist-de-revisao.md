# 06 - Checklist de revisão da arquitetura

[Índice e convenções](README.md)

## 1. Finalidade e modo de preenchimento

Este checklist reúne os critérios dos cinco documentos. **Nenhuma verificação foi executada contra o repositório nesta entrega.** Todas as linhas começam como `não verificado` (NV). As verificações propostas derivam da teoria; os testes e complementos de engenharia são uma adaptação para revisar o Enlace, não uma lista oficial de exigências do professor.

Antes de preencher, registrar:

| Informação | Valor a preencher na auditoria |
| --- | --- |
| Data e responsável | A preencher |
| Branch e commit inspecionados | RealDeal (fbd278f) |
| Expo SDK e versões relevantes | Expo SDK 58, React Native 0.88.1, TypeScript ~5.9.2, expo-router ~58.0.31, @supabase/supabase-js ^2.49.1 |
| Plataformas/dispositivos | Não testado em dispositivo físico (sem builds nativos android/ios) |
| Expo Go, development build ou build final | Não gerado (sem pastas android/ ios/) |
| Ambiente Supabase inspecionado | Não verificado em servidor real (credenciais em .env.local, não registrado) |
| Funcionalidades em escopo | Adoção de animais: anúncios, fotos, localização aproximada, favoritos, interesse, sincronização offline-first, moderação admin |
| Fontes adicionais de requisitos | docs/documentacao-software-rede-adocao-animais.md, docs/criteriosapresentacao1.md, docs/arquitetura/ |

### Status

| Código | Status | Critério |
| --- | --- | --- |
| AT | Atendido | Há evidência suficiente para o comportamento descrito |
| PA | Parcial | Parte do comportamento existe, mas há lacuna demonstrada |
| AU | Ausente | A investigação confirmou que a garantia aplicável não existe |
| NA | Não aplicável | O recurso ou condição não faz parte do escopo, com justificativa |
| NV | Não verificado | Falta acesso, execução, informação ou inspeção suficiente |

Não usar AU apenas porque um nome de função não foi encontrado. Uma solução equivalente pode atender à regra. AT deve indicar o nível da evidência: código inspecionado, teste executado, aparelho usado ou configuração remota consultada. Um teste que não pôde ser executado continua não executado, mesmo que o código pareça correto.

### Prioridade sugerida, após demonstrar a falha

- **P0:** acesso indevido, segredo exposto ou perda/corrupção de dados comprovada; tratar antes de publicar.
- **P1:** falha em fluxo principal, duplicação, sincronização sem recuperação ou promessa offline descumprida.
- **P2:** desempenho, experiência de uso, clareza de estados e manutenção sem falha crítica imediata.
- **P3:** melhoria opcional ou futura que depende de necessidade ainda não confirmada.

As prioridades não são automaticamente atribuídas pelo assunto. Um risco hipotético deve ser registrado como hipótese a verificar, não como defeito comprovado.

## 2. Inventário inicial

Antes das regras, localizar evidências de:

- Rotas/telas de criação, edição, consulta e detalhes de anúncios.
- Entrada por câmera e/ou galeria e tratamento de permissões.
- Representação de fotos, localização, disponibilidade e eventual exclusão.
- Banco local, schemas, migrations e atualização da UI.
- Arquivos temporários, persistentes e rotina de limpeza.
- Cliente remoto, autenticação, tabelas, buckets e políticas.
- Fila/estado de sincronização, gatilhos, confirmação e recuperação.
- Funcionalidades opcionais efetivamente presentes: vídeo, QR, álbuns e IA.

Registrar os caminhos reais. Não reorganizar diretórios apenas para que seus nomes coincidam com esta lista.

## 3. Persistência e sincronização

Referência: [01 - Offline-first](01-offline-first.md). A origem e os complementos de cada regra estão no documento.

| ID | Pergunta de revisão / evidência esperada | Status | Evidência ou justificativa |
| --- | --- | --- | --- |
| OFF-01 | O contrato offline está definido e leitura/escrita local persistem sem rede? | PA | SQLite local com `expo-sqlite` em `src/infrastructure/database/sqlite/`. Novo-anuncio e editar-anuncio funcionam offline e gravam na fila de sync (`src/application/use-cases/CreateAnimalUseCase.ts`, `UpdateAnimalUseCase.ts`). Não testado em cenário de avião + fechar/reabrir. Evidência: `src/infrastructure/database/sqlite/migrations.ts`, `src/application/use-cases/CreateAnimalUseCase.ts`, `src/infrastructure/composition/loadAppContainer.ts` |
| OFF-02 | Migrations preservam dados e pendências; mudanças do sync chegam à UI? | PA | `migrations.ts` usa `CREATE TABLE IF NOT EXISTS` (preserva dados existentes). `SqliteUnitOfWork` disponível. Não há versionamento de migrations para evolução de schema. Evidência: `src/infrastructure/database/sqlite/migrations.ts`, `src/infrastructure/database/sqlite/SqliteUnitOfWork.ts` |
| OFF-03 | Identificadores globais e metadados de sync permitem reconhecer o mesmo registro no reenvio? | PA | UUID como `id`, `updated_at`, `version` em `Animal` e `AnimalPhoto`. `SyncAction` com `attempts`, `status`, `lastError`. Não testado em dois aparelhos simultâneos. Evidência: `src/domain/entities/SyncAction.ts`, `src/domain/entities/Animal.ts`, `src/domain/entities/AnimalPhoto.ts`, `src/domain/value-objects/SyncState.ts` |
| OFF-04 | Dado e operação pendente são persistidos atomicamente, com dependências respeitadas? | PA | `SqliteUnitOfWork` implementa `withTransactionAsync`. Use cases criam anúncio + registro de fila dentro da mesma transação. Não testado interrupção de gravação no meio da transação. Evidência: `src/infrastructure/database/sqlite/SqliteUnitOfWork.ts`, `src/application/use-cases/CreateAnimalUseCase.ts`, `src/application/ports/UnitOfWork.ts` |
| OFF-05 | O servidor reconhece reenvios e há retry adequado, sem duplicação? | PA | `SyncAction` com `attempts`, `status`, `lastError`; `ProcessSyncQueueUseCase` processa e incrementa tentativas. Não há backoff exponencial explícito. Idempotência remota não testada contra servidor real. Evidência: `src/domain/entities/SyncAction.ts`, `src/application/use-cases/ProcessSyncQueueUseCase.ts` |
| OFF-06 | Lote e cursor são consistentes, ou há estratégia de recebimento equivalente justificada? | PA | **Decisão da ordem 6 (06/11/2026): cursor/delta.** Keyset `(updated_at, id)` com o carimbo do SERVIDOR (trigger também no INSERT), páginas de 200 e sobreposição de 60 s ao retomar. O cursor só é gravado ao fim do pull completo e nunca recua. Teste executado com backend simulado: `PullDelta.test.ts` (paginação, empate de carimbo, transação atrasada, relógio do aparelho atrasado, falha sem avanço do cursor — T05). **Lacuna:** triggers e índice do `init.sql` não foram aplicados num servidor real (ordem 8). |
| OFF-07 | Conflitos e edições durante envio têm regra, sem confirmação indevida de revisão nova? | PA | `ConflictResolutionService` com last-write wins automático e revisão manual para divergência de status. `ResolveSyncConflictUseCase` e tela `conflito/[id]`. Não testado em dois aparelhos. Evidência: `src/domain/services/ConflictResolutionService.ts`, `src/application/use-cases/ResolveSyncConflictUseCase.ts`, `app/(protected)/conflito/[id].tsx` |
| OFF-09 | Gatilhos são coordenados e falhas não deixam o worker travado? | NV | `AutoSync` + `RunFullSyncUseCase` com trava `runningPromise` (anti-concorrência). `useAutoSync` dispara na recuperação de conexão. Não testado reconexão + botão manual simultâneo; não verificado se trava é liberada após falha. Evidência: `src/adapters/sync/AutoSync.tsx`, `src/application/use-cases/RunFullSyncUseCase.ts`, `src/adapters/hooks/useAutoSync.ts` |
| OFF-10 | A UI distingue salvo localmente, pendente, sincronizado e erro? | NV | `SyncScreen` exibe contador de pendências, chip "Salvo no aparelho", feedback de resultado. Badge de notificações em `app/(tabs)/_layout.tsx`. Não testado estados coerentes em ausência de rede, falha permanente, nova tentativa. Evidência: `app/(tabs)/sync.tsx`, `app/(tabs)/_layout.tsx` |
| OFF-11 | CRUD, localização e mídia usam estratégias adequadas, sem impor rastreamento ou vídeo desnecessários? | NV | Localização pontual apenas na criação de anúncio (`handleUseMyLocation`). CRUD via outbox (`sync_queue`). Mídia com fila de upload (`SyncAction` entityType 'photo'). Não testado se estratégia corresponde ao dado real sem excessos. Vídeo não está no escopo. Evidência: `src/infrastructure/device/location/LocationAdapter.ts`, `src/application/use-cases/SearchAnimalsUseCase.ts`, `src/domain/entities/SyncAction.ts` |

Se OFF-06 usar snapshot em lugar de delta, registrar a justificativa e verificar completude/reconciliação. *(Enlace: a ordem 6 decidiu por delta — ver linha OFF-06.)* NA só é adequado quando a condição realmente não existe; não deve ocultar um requisito de atualização remota do produto.

## 4. Permissões e seleção

Referência: [02 - Câmera, permissões e seleção](02-camera-permissoes-e-selecao.md).

| ID | Pergunta de revisão / evidência esperada | Status | Evidência ou justificativa |
| --- | --- | --- | --- |
| PER-01 | A permissão necessária é solicitada no contexto correto, sem bloquear indevidamente o app? | NV | `ImagePickerCameraAdapter` solicita câmera/galeria quando o usuário aciona. Permissões declaradas em `app.json` (iOS NSCameraUsageDescription, NSPhotoLibraryUsageDescription; Android CAMERA, READ_MEDIA_IMAGES). Não testado instalação nova + negação sem quebrar o app. Evidência: `src/infrastructure/device/camera/ImagePickerCameraAdapter.ts`, `app.json` |
| PER-02 | Carregamento, negação, impossibilidade de perguntar e retorno das configurações são tratados? | NV | `handleUseMyLocation` em novo-anuncio trata erro de localização com alert. Não há tratamento completo de fluxo de permissão (carregamento, negação permanente, retorno de configurações) para câmera. Evidência: `app/(protected)/novo-anuncio.tsx` |
| PER-03 | Configuração nativa e mensagens correspondem aos recursos e ao build testado? | NV | Plugins de câmera, localização, image-picker, secure-store, splash-screen em `app.json`. Não verificado em build distribuído (sem pastas android/ ios/). Evidência: `app.json` |
| PER-04 | ImagePicker/CameraView foram escolhidos conforme o requisito e fazem a ação anunciada? | NV | `ImagePickerCameraAdapter` implementa `capturePhoto()` e `pickImageFromGallery()` via `expo-image-picker`. Não testado em dispositivo físico. Evidência: `src/infrastructure/device/camera/ImagePickerCameraAdapter.ts` |
| PER-05 | Cancelamento, assets ausentes e resultados inválidos não geram erros nem registros vazios? | NV | Verifica `res?.uri` antes de usar em novo-anuncio e editar-anuncio. Não testado cancelar preservando foto anterior sem criar registro vazio. Evidência: `app/(protected)/novo-anuncio.tsx`, `app/(protected)/editar-anuncio/[id].tsx` |
| PER-06 | Tipos, quantidade e opções de seleção são coerentes com o produto e a plataforma? | NV | Limite de 4 fotos por anúncio enforceado na UI e no domínio (`Animal` agregado com `MAX_PHOTOS_PER_ANIMAL`). Não testado selecionar múltiplos, atingir limite, tipo não aceito. Evidência: `app/(protected)/novo-anuncio.tsx` (linhas 73-88, 107-109), `src/domain/entities/Animal.ts` |
| PER-07 | Exibir uma URI temporária é distinguido de salvar o arquivo persistentemente? | NV | `SqlitePhotoStorage` persiste caminhos locais em SQLite (`animal_photos` com `local_path`). Não testado salvar/encerrar/reabrir mantendo referência válida após limpeza de cache. Evidência: `src/infrastructure/database/sqlite/repositories/SqlitePhotoStorage.ts` |

## 5. Captura, vídeo e códigos

Referência: [03 - Captura de foto, vídeo e QR](03-captura-foto-video-e-qr.md).

| ID | Pergunta de revisão / evidência esperada | Status | Evidência ou justificativa |
| --- | --- | --- | --- |
| CAP-01 | A câmera deixa de capturar quando a tela/app não precisa dela? | NA | Projeto usa `expo-image-picker` (seletor nativo do sistema), não `CameraView` próprio. Não há câmera montada na tela para desmontar. Evidência: `src/infrastructure/device/camera/ImagePickerCameraAdapter.ts` |
| CAP-02 | Permissão, layout, prontidão e falhas de montagem são tratados antes da ação? | NA | Sem `CameraView` próprio; permissão é solicitada via ImagePicker no contexto da ação. Evidência: `src/infrastructure/device/camera/ImagePickerCameraAdapter.ts` |
| CAP-03 | Capturas simultâneas são impedidas e falhas liberam o estado de captura? | NA | ImagePicker é síncrono por fluxo; não há estado de captura concorrente a gerenciar. Evidência: `src/infrastructure/device/camera/ImagePickerCameraAdapter.ts` |
| CAP-04 | Refazer/cancelar/aceitar foto não apaga trabalho anterior nem cria uploads descartados? | NA | Sem tela de revisão própria da câmera; remoção de foto via `removePhoto` no formulário. Não cria uploads descartados. Evidência: `app/(protected)/novo-anuncio.tsx`, `app/(protected)/editar-anuncio/[id].tsx` |
| CAP-05 | Se houver vídeo, gravação, áudio, limites e interrupção têm estados coerentes? | NA | Vídeo não está no escopo do Enlace. |
| CAP-06 | Se houver vídeo, revisão/reprodução e uso de capas têm comportamento adequado? | NA | Vídeo não está no escopo do Enlace. |
| CAP-07 | Se houver scanner, tipos são restritos e leituras repetidas não repetem ações? | NA | QR Code / códigos de barras não estão no escopo do Enlace. |
| CAP-08 | Se houver scanner, o conteúdo é validado antes de abrir destinos ou executar ações? | NA | QR Code / códigos de barras não estão no escopo do Enlace. |

Se o Enlace utilizar apenas a câmera nativa por ImagePicker, critérios exclusivos da CameraView podem ser NA, desde que essa escolha satisfaça o requisito acadêmico e de produto confirmado.

## 6. Tratamento e arquivos

Referência: [04 - Tratamento e armazenamento de mídia](04-tratamento-e-armazenamento-de-midia.md).

| ID | Pergunta de revisão / evidência esperada | Status | Evidência ou justificativa |
| --- | --- | --- | --- |
| MID-01 | Tratamento/compressão têm qualidade e redução medidas; MIME/extensão/bytes são coerentes? | NV | `ExpoImageManipulatorAdapter` e `WebpPhotoStorage` implementam tratamento de imagem. Não testado redução de tamanho medida, qualidade visual, coerência MIME/extensão/bytes. Evidência: `src/infrastructure/device/image/ExpoImageManipulatorAdapter.ts`, `src/application/photos/WebpPhotoStorage.ts` |
| MID-02 | O arquivo aceito sai do cache temporário e falhas entre filesystem e banco são recuperáveis? | NV | `SqlitePhotoStorage` persiste caminhos locais em SQLite. Não testado interromper app e reabrir; não há rotina explícita de cópia do cache temporário para diretório persistente. Evidência: `src/infrastructure/database/sqlite/repositories/SqlitePhotoStorage.ts` |
| MID-03 | O banco guarda referências e estados válidos, sem binários grandes/base64 injustificados? | NV | Tabela `animal_photos` com `local_path`, `remote_url`, `upload_status`. Não armazena base64. Não testado metadados apontam para arquivo certo; upload pendente tem fonte disponível. Evidência: `src/infrastructure/database/sqlite/migrations.ts`, `src/domain/entities/AnimalPhoto.ts` |
| MID-04 | Se houver exportação/álbum/listagem de galeria, permissões e limites são tratados? | NA | Não é escopo do Enlace (não há exportação para galeria do usuário nem álbuns). |
| MID-05 | Listas usam mídia adequada ao tamanho de exibição e tratam ausência/expiração? | NV | `FALLBACK_PHOTO` (Unsplash) usado quando não há foto local/remota. Não testado URL expirada renovada; offline usa cópia local disponível. Evidência: `app/(tabs)/index.tsx`, `app/animal/[id].tsx` |
| MID-06 | Se houver vídeo, limites e estratégia de upload são adequados ao tamanho e à recuperação? | NA | Vídeo não está no escopo do Enlace. |
| MID-07 | EXIF e localização enviados/armazenados correspondem à finalidade e à visibilidade definidas? | NV | Localização aproximada (bairro/cidade) sem endereço exato; privacidade protegida. Não testado inspecionar EXIF do arquivo final vs. localização pública. Evidência: `src/domain/value-objects/ApproximateLocation.ts`, `app/animal/[id].tsx` |
| MID-08 | Se houver reconhecimento, segredos e autorização ficam no backend e erros são recuperáveis? | NA | Reconhecimento de imagem / IA não está no escopo do Enlace. |
| MID-09 | Limpeza, cancelamento, falta de espaço e progresso preservam arquivos ainda necessários? | NV | Não há rotina de limpeza explícita de temporários no código. Não testado falta de espaço/cancelamento. Evidência: ausência de rotina de limpeza no repositório. |

## 7. SQLite, Supabase e segurança

Referência: [05 - SQLite, Supabase e segurança](05-sqlite-supabase-e-seguranca.md).

| ID | Pergunta de revisão / evidência esperada | Status | Evidência ou justificativa |
| --- | --- | --- | --- |
| DAT-01 | Conexão/schema têm ciclo de vida definido e não dependem só de CREATE IF NOT EXISTS para evoluir? | PA | `DatabaseDriver`, `applyMigrations`, `getDatabaseDriver` definem conexão e schema. `CREATE TABLE IF NOT EXISTS` sozinho não evolui schema antigo (não há migrations versionadas). Evidência: `src/infrastructure/database/sqlite/DatabaseDriver.ts`, `src/infrastructure/database/sqlite/migrations.ts` |
| DAT-02 | SQL usa parâmetros ou mecanismo equivalente, sem interpolação insegura? | NV | `InMemorySqliteDriver` e `ExpoSqliteDriver` usam parâmetros (`?`). Não testado título com apóstrofo ou entrada semelhante a SQL. Evidência: `src/infrastructure/database/sqlite/DatabaseDriver.ts` |
| DAT-03 | Sessão inicial, expirada e ausente são tratadas sem perder ou enviar pendências com identidade errada? | NV | `SupabaseAuthGateway` gerencia login, registro, restauração de sessão. `createSessionStorage` usa `expo-secure-store` com fallback em memória. Não testado expiração durante sync; não verificado se pendências são enviadas com identidade correta após reautenticação. Evidência: `src/infrastructure/supabase/auth/SupabaseAuthGateway.ts`, `src/infrastructure/supabase/client.ts` |
| DAT-04 | Não há credenciais privilegiadas no cliente, configuração pública ou logs? | NV | `.env.example` com placeholders; `.env.local` no `.gitignore`. `EXPO_PUBLIC_*` apenas no cliente. Não verificado bundle, logs ou histórico para credenciais privilegiadas. Evidência: `.env.example`, `.env.local`, `.gitignore`, `src/infrastructure/supabase/client.ts` |
| DAT-05 | RLS distingue leitura pública/privada e operações do dono; vínculos entre entidades são autorizados? | NV | Políticas RLS definidas em `init.sql` (profiles, animals, animal_photos, favorites, adoption_interests, tombstones). Não verificadas em servidor real. Evidência: `supabase/init.sql` |
| DAT-06 | Políticas do Storage protegem as operações necessárias, o bucket e os caminhos corretos? | NV | Bucket `animal-photos` público definido em `init.sql`. Não verificado em servidor real se A não acessa arquivos de B. Evidência: `supabase/init.sql` |
| DAT-07 | Referência estável é separada da URL; acesso privado e renovação de URL são tratados? | NV | Schema tem `storage_path` (referência estável) e `public_or_signed_url`. Não testado URL expirada renovada; offline usa cópia local. Evidência: `supabase/init.sql`, `src/domain/entities/AnimalPhoto.ts` |
| DAT-08 | Upload tem identidade estável, corpo/formato compatíveis e reenvio sem duplicação? | NV | `SupabasePhotoStorage.uploadPending` e `SupabaseAnimalRepository.syncRemotePhotos` gerenciam upload. Não testado reenvio após timeout sem criar arquivos duplicados contra servidor real. Evidência: `src/infrastructure/supabase/storage/SupabasePhotoStorage.ts`, `src/infrastructure/supabase/repositories/SupabaseAnimalRepository.ts` |
| DAT-09 | Sucessos parciais são retomados; só a revisão completamente enviada é confirmada? | NV | Estados de `SyncAction` (`PENDING`, `SYNCING`, `FAILED`, `COMPLETED`) e `SyncState`. Não testado sucesso parcial (upload concluído, insert falha → retomar sem duplicar). Evidência: `src/domain/entities/SyncAction.ts`, `src/domain/value-objects/SyncState.ts` |
| DAT-11 | Worker, listeners, dependências e classificação de erros permitem novas tentativas? | NV | `AutoSync` + `RunFullSyncUseCase` com trava `runningPromise`. `useAutoSync` dispara na reconexão. Não testado falha sem travar worker permanentemente; erro em uma execução não bloqueia todos. Evidência: `src/adapters/sync/AutoSync.tsx`, `src/application/use-cases/RunFullSyncUseCase.ts`, `src/adapters/hooks/useAutoSync.ts` |
| DAT-12 | Exclusões e limpeza coordenam linha/arquivo sem ressuscitar ou apagar mídia ainda referenciada? | NV | Trigger `sync_animal_tombstones` em `init.sql` propaga exclusões/ocultações. Não testado em servidor real: excluir com rede instável não faz reaparecer; limpeza não remove mídia referenciada. Evidência: `supabase/init.sql` |

## 7.5. Validação das camadas de domínio e aplicação (Item 2 da ordem de execução)

Conforme o item 2 do `docs/ordem_de_execucao.md`, foram validadas as camadas já implementadas:

| Validação | Status | Evidência |
|---|---|---|
| `src/domain/` é 100% puro (sem imports de Expo, React Native, Supabase, SQLite ou UI) | AT | Grep confirmado: zero matches para bibliotecas de infraestrutura em `src/domain/` |
| Value Objects imutáveis e validados na criação | AT | `AnimalCharacteristics`, `ApproximateLocation`, `SearchRadius` (limite 10 km), `AdoptionStatus`, `SyncState` em `src/domain/value-objects/` |
| Interfaces em `src/domain/ports/` são puramente declarativas | AT | 18 ports importam apenas de entidades e value objects do próprio domínio (confirmado via grep) |
| 14 use cases orquestram via portas, sem regras de negócio puras nem código de interface | AT | 14 arquivos em `src/application/use-cases/` (Create, Delete, Get, MarkAdopted, Moderate, ProcessSyncQueue, PullRemote, RegisterInterest, ResolveConflict, RunFullSync, Search, ToggleFavorite, Update, UpdateInterestStatus) |
| `UnitOfWork` garante consistência transacional entre SQLite e fila de sincronização (OFF-04) | PA | `SqliteUnitOfWork` implementa `withTransactionAsync`. Use cases criam entidade + registro de fila na mesma transação. Não testado interrupção de gravação no meio da transação. Evidência: `src/infrastructure/database/sqlite/SqliteUnitOfWork.ts`, `src/application/ports/UnitOfWork.ts` |
| Testes de use cases implementados com fakes in-memory | AT | 9 arquivos de teste em `src/__tests__/use-cases/` cobrindo todos os 14 use cases. 65 testes passando (incluindo 7 de domínio existentes). Fakes em `src/__tests__/fakes/in-memory-repositories.ts`. Evidência: `npm test` passa, `tsc --noEmit` limpo. |

---

## 8. Cenários de validação

Executar em ambiente de teste com dados próprios. As contas A e B devem ser contas controladas pela equipe. Interrupções de processo, limpeza de cache e simulação de falhas precisam preservar dados reais. Quando um cenário não puder ser executado, registrar o motivo e a parte validada por inspeção.

| Teste | Procedimento | Resultado esperado | Regras principais |
| --- | --- | --- | --- |
| T01 | Sem internet, criar/editar um anúncio ou rascunho no escopo offline; fechar e reabrir | Dados e fotos aceitas reaparecem; estado remoto continua pendente | OFF-01, OFF-10, MID-02 |
| T02 | Salvar dados e pendências em uma versão antiga; atualizar com migration | Dados preservados, schema atualizado e pendências ainda processáveis | OFF-02, DAT-01 |
| T03 | Interromper uma gravação local antes da confirmação da transação | Não existe dado confirmado sem sua pendência correspondente, nem pendência inválida | OFF-04 |
| T04 | Servidor aceita a mutação, mas a resposta ao cliente é perdida; reenviar | Um único resultado lógico; retry reconhece a operação | OFF-03, OFF-05, DAT-08 |
| T05 | Falhar ao aplicar um item de um lote de pull; reiniciar | Cursor não pula o lote incompleto; repetição mantém consistência | OFF-06 |
| T06 | Editar o mesmo anúncio em dois aparelhos e sincronizar | Política de conflito observável, sem descarte silencioso fora do contrato | OFF-07 |
| T07 | Alterar uma descrição/foto enquanto a revisão anterior está sendo enviada | Confirmar a revisão antiga não elimina a pendência da nova | OFF-07, DAT-09 |
| T08 | Excluir em A; manter B offline e depois sincronizar | Item não reaparece; tombstone/recarga segue política de retenção | OFF-08, DAT-12 |
| T09 | Disparar reconexão e sincronização manual juntas; provocar falha no worker | Sem processamento duplicado; trava liberada para nova tentativa | OFF-09, DAT-11 |
| T10 | Negar câmera, negar permanentemente, conceder nas configurações e voltar | Mensagens e ações corretas, formulário preservado, permissão reavaliada | PER-01, PER-02, PER-03 |
| T11 | Cancelar seletor; retornar asset inválido em teste; selecionar múltiplos itens no limite | Nenhum registro vazio; mídia anterior preservada; limite respeitado | PER-05, PER-06 |
| T12 | Abrir câmera, navegar para outra tela, ir ao background e retornar; tocar rapidamente em capturar | Câmera acompanha ciclo de vida; uma captura por vez; falhas não travam a UI | CAP-01, CAP-02, CAP-03 |
| T13 | Capturar, refazer, aceitar e cancelar em sequências diferentes | Apenas mídias confirmadas seguem para persistência; associação correta ao anúncio | CAP-04, PER-07 |
| T14 | Tratar fotos com orientações, dimensões e formatos diferentes | Saída visual correta, tamanho medido e MIME compatível com os bytes | MID-01, DAT-08 |
| T15 | Após salvar, remover apenas cache temporário em ambiente de teste; simular falta de espaço/cópia interrompida | Arquivos persistentes continuam válidos; falhas não geram falsa confirmação | MID-02, MID-03, MID-09 |
| T16 | Confirmar upload e falhar ao gravar metadados; depois tentar novamente | Reutiliza/reconcilia arquivo remoto e conclui associação sem duplicar | DAT-08, DAT-09 |
| T17 | Expirar sessão durante sync e repetir após autenticação válida | Trabalho preservado e enviado com a conta correta | DAT-03, DAT-11 |
| T18 | Como A, tentar ler/alterar dados privados e arquivos de B; testar usuário não autenticado | Acesso negado onde privado; leitura pública apenas conforme política; escrita protegida | DAT-05, DAT-06 |
| T19 | A cria pendência offline; troca para B; depois retorna para A | B não vê nem envia pendência de A; dados seguem política explícita de preservação | DAT-10 |
| T20 | Expirar uma URL assinada e abrir a foto novamente, online e offline | Renovação autorizada online; cópia local/estado indisponível coerente offline | DAT-07, MID-05 |
| T21 | Remover foto com falha na etapa de banco ou Storage; executar nova tentativa/limpeza | Remoção converge sem afetar outros arquivos; não sobram pendências invisíveis | DAT-12, MID-09 |
| T22 | Inspecionar EXIF do arquivo final e comparar com a localização pública do anúncio | Só os dados pretendidos são expostos; GPS preciso não vaza por acidente | MID-07, OFF-11 |
| T23 | Se houver vídeo, negar áudio, alcançar limite e interromper upload relevante ao tamanho | Estado recuperável; sem gravação oculta; retomada coerente com o contrato | CAP-05, CAP-06, MID-06 |
| T24 | Se houver QR, manter código na câmera e testar conteúdo inválido | Uma ação controlada por leitura; conteúdo inválido não executa ação arbitrária | CAP-07, CAP-08 |
| T25 | Se houver galeria/álbum, negar acesso e testar no build de destino | Erro compreensível e funcionamento dentro das permissões reais | MID-04 |
| T26 | Se houver IA, invocar análise com arquivo próprio e de outra conta; simular timeout | Autorização aplicada; segredo ausente no cliente; falha não destrói dados | MID-08, DAT-04 |
| T27 | Gravar título com apóstrofo e entrada semelhante a SQL | Conteúdo tratado como dado, sem alterar comandos ou outras linhas | DAT-02 |
| T28 | Sincronizar alteração remota com a lista aberta | UI reflete a alteração pelo banco local, sem estado contraditório | OFF-02, OFF-10 |

Esses cenários podem ser automatizados onde fizer sentido, mas permissões nativas, câmera, arquivos, build e políticas remotas também precisam de validação no ambiente apropriado. Não declarar sucesso em aparelho a partir de testes unitários apenas.

## 9. Modelo de registro de achado

Copiar e preencher para cada problema demonstrado. Não preencher com suposições.

```markdown
### Achado: [descrição concreta]

- Regras relacionadas: [IDs]
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

## 10. Ordem sugerida de correção

1. Corrigir acesso indevido, segredos expostos e perda de dados comprovados.
2. Estabilizar identidade, migrations, arquivo persistente e gravação atômica de pendências.
3. Corrigir idempotência, sucesso parcial, conflitos e exclusões.
4. Ajustar permissões, ciclo de vida, feedback e recuperação dos fluxos principais.
5. Otimizar mídia/listas e avaliar recursos opcionais apenas quando necessários.

Adaptar a ordem às dependências reais. Uma mudança de schema pode ser pré-requisito para uma correção do sync. Não resolver tudo em uma refatoração única sem necessidade.

## 11. Critério para encerrar a revisão

A revisão termina com cada item classificado e justificado, os problemas relevantes corrigidos ou explicitamente pendentes e as limitações de verificação registradas. Ela não exige AT para funcionalidades fora do escopo: NA bem fundamentado é um resultado válido.

O relatório deve distinguir:

- O que foi encontrado no código atual.
- O que foi alterado, quando a implementação tiver sido solicitada.
- Quais testes e verificações foram efetivamente executados.
- O que depende de configuração remota, aparelho físico ou decisão da equipe.

Preservar esse registro ao evoluir o projeto. A documentação só passa a descrever uma decisão adotada quando a equipe a registra e a implementação correspondente é identificada.
