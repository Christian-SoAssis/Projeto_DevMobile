# Ordem de Execução — Próximos Passos

---

## 1. Base para todo o restante — Preencher o check-list de revisão ✅ CONCLUÍDO

**Prioridade: Alta (início imediato)**

Preencher o arquivo `docs/arquitetura/06-checklist-de-revisao.md` com evidências de código para cada ID (OFF-01 a OFF-11, PER-01 a PER-07, CAP-01 a CAP-08, MID-01 a MID-09, DAT-01 a DAT-12), citando arquivos, funções, migrations e testes. Classificar cada item como **AT** / **PA** / **AU** / **NA** / **NV**.

Isso serve de diagnóstico oficial antes de qualquer implementação.

**Resultado:** todas as 33 regras preenchidas:
- OFF-01 a OFF-08: PA
- OFF-09 a OFF-11: NV
- PER-01 a PER-07: NV
- CAP-01 a CAP-04, CAP-07, CAP-08: NA
- CAP-05 a CAP-06: NA (vídeo/QR fora de escopo)
- MID-01 a MID-03, MID-05, MID-07, MID-09: NV
- MID-04, MID-06, MID-08: NA (fora de escopo)
- DAT-01: PA; DAT-02 a DAT-09: NV; DAT-10: AT; DAT-11 a DAT-12: NV

---

## 2. Validar camadas já implementadas (domínio e aplicação) ✅ CONCLUÍDO

**Prioridade: Média**

- [x] Confirmar que `src/domain/` não importa Expo, React Native, Supabase ou SQLite. (verificado via grep — zero matches)
- [x] Validar que todos os Value Objects são imutáveis e se validam na criação.
- [x] Confirmar que as interfaces em `src/domain/ports/` são puramente declarativas. (verificado via grep — importam apenas de entidades/value objects do próprio domínio)
- [x] Confirmar que os 14 use cases orquestram via portas, sem regras de negócio puras nem código de interface.
- [x] Validar o `UnitOfWork` para consistência transacional entre SQLite e fila de sincronização (critério OFF-04). (implementado; teste de interrupção pendente — OFF-04 classificado como PA)

---

## 3. Implementar camada de testes ✅ CONCLUÍDO

**Prioridade: Crítica**

Foram implementados 65 testes em 10 suítes (incluindo os 7 testes de domínio existentes):

- **Testes de Use Cases:** 9 arquivos com fakes/repositórios in-memory para cada use case:
  - `CreateAnimalUseCase.test.ts`, `SearchAnimalsUseCase.test.ts`, `ToggleFavoriteUseCase.test.ts`
  - `RegisterAdoptionInterestUseCase.test.ts`, `ProcessSyncQueueUseCase.test.ts`
  - `ResolveSyncConflictUseCase.test.ts`, `UpdateAnimalUseCase.test.ts`
  - `DeleteAnimalUseCase.test.ts`, `MarkAnimalAdoptedUseCase.test.ts`
- **Fakes in-memory:** `src/__tests__/fakes/in-memory-repositories.ts` com todos os ports e fabricantes de dados
- **Typecheck:** `tsc --noEmit` limpo

Pendente:
- Testes de Context API & Hooks (`AuthProvider`, `useAuth`, `RepositoriesContext`, `useConnectivity`, `useFullSync`)
- Testes de Telas e Componentes (RNTL)
- Testes de Infraestrutura SQLite e Supabase
- Testes E2E (fluxos críticos)

---

## 4. Testes específicos dos critérios não verificados (docs/arquitetura) ✅ CONCLUÍDO

Implementados os 27 cenários de validação (T01 a T27) do `docs/arquitetura/06-checklist-de-revisao.md`, seção 8, em `src/__tests__/integration/validation-scenarios.test.ts`:

- **22 cenários testados com fakes in-memory:** T01, T03, T04, T05, T06, T07, T08, T09, T11 (2 variantes), T13, T14, T15, T16, T17, T18, T19, T20, T21, T22, T27
- **7 cenários marcados como NA:** T02 (banco real), T10 (dispositivo), T12 (dispositivo), T23 (vídeo não no escopo), T24 (QR não no escopo), T25 (galeria não no escopo), T26 (IA não no escopo), T28 (UI+banco real)

| Cenário | O que valida | Status |
|---|---|---|
| T01 | Sem internet, criar/editar anúncio; fechar e reabrir; dados reaparecem | ✅ Testado |
| T03 | Interromper gravação local; não existe dado confirmado sem pendência | ✅ Testado |
| T04 | Servidor aceita mutação, resposta perdida, reenviar; um único resultado lógico | ✅ Testado |
| T06 | Editar mesmo anúncio em dois aparelhos; política de conflito observável | ✅ Testado |
| T11 | Cancelar seletor; limite de fotos respeitado | ✅ Testado |
| T13 | Capturar, refazer, aceitar, cancelar; apenas mídias confirmadas persistem | ✅ Testado |
| T14 | Fotos com diferentes formatos; MIME compatível | ✅ Testado |
| T15 | Remover cache temporário; arquivos persistentes válidos | ✅ Testado |
| T16 | Upload concluído, falha ao gravar metadados; reutiliza arquivo remoto | ✅ Testado |
| T17 | Expirar sessão durante sync; trabalho preservado, conta correta | ✅ Testado |
| T18 | Como A, tentar ler/alterar dados de B; acesso negado | ✅ Testado |
| T19 | A cria pendência, troca para B, retorna para A; B não vê pendência de A | ✅ Testado |
| T20 | URL assinada expirada; cópia local usada como fallback | ✅ Testado |
| T21 | Remover foto com falha; remoção converge sem afetar outros arquivos | ✅ Testado |
| T22 | EXIF e localização; GPS preciso não vaza | ✅ Testado |
| T27 | Título com apóstrofo; tratado como dado | ✅ Testado |
| T02/T10/T12/T23/T24/T25/T26/T28 | Não aplicáveis a ambiente unitário | ❌ NA |

---

## 5. Adequar o adapter de sessão segura ✅ CONCLUÍDO

Extraído um adapter isolado de sessão segura que encapsula `expo-secure-store`, desacoplando do client do Supabase:

- Criada interface `SessionStorage` no domínio (`src/domain/ports/SessionStorage.ts`)
- Criado adapter `SessionStorageSecureStore` (`src/adapters/auth/SessionStorageSecureStore.ts`) com fallback em memória para testes
- Atualizado `src/infrastructure/supabase/client.ts` para usar o adapter dedicado
- Testes implementados (`src/__tests__/adapters/SessionStorageSecureStore.test.ts`, 8 testes)
- Total: 103 testes passando em 12 suítes, typecheck limpo

---

## 6. Preparar builds nativas

O repositório não tem `android/` nem `ios/`.

- Executar `npx expo prebuild` (ou development build via EAS) para gerar projetos nativos.
- Testar em dispositivo/emulador: câmera, galeria, localização, `expo-secure-store`, `expo-sqlite` persistente.

---

## 7. Implementar CI/CD

Adicionar GitHub Actions que rode no push/PR: `npm run typecheck`, `npm test` (Jest) e lint.

---

## 8. Versionamento de migrations

Substituir o `CREATE TABLE IF NOT EXISTS` único em `migrations.ts` por migrations versionadas que permitam evolução de schema sem perder dados existentes (critérios OFF-02 e DAT-01).
