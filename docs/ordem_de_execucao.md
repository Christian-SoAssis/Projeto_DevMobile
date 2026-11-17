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

## 3. Implementar camada de testes (PRIORIDADE MAIS ALTA)

**Prioridade: Crítica**

Atualmente existem apenas 7 testes de domínio (`enlace.test.ts`). Faltam:

- **Testes de Use Cases:** com fakes/repositórios in-memory para cada use case (caminho feliz, tratamento de erros, falta de permissões).
- **Testes de Context API & Hooks:** `AuthProvider`, `useAuth`, `RepositoriesContext`, `useConnectivity`, `useFullSync`.
- **Testes de Telas e Componentes:** configurar `@testing-library/react-native` (RNTL) e simular ações do usuário.
- **Testes de Infraestrutura (SQLite):** migrations, persistência de cache após reinício, transações atômicas.
- **Testes de Infraestrutura (Supabase):** gateways com mock (RLS, bloqueio de edição por terceiro, proteção de favoritos/interesses, upload de fotos, controle de versão).
- **Testes E2E:** fluxos críticos completos (visitante busca animal, usuário favorita, responsável cria anúncio online/offline, sincroniza, edição offline, fluxo de conflito, marca adotado, bloqueio de edição de terceiro).

---

## 4. Testes específicos dos critérios não verificados (docs/arquitetura)

Implementar os 27 cenários de validação (T01 a T27) do `docs/arquitetura/06-checklist-de-revisao.md`, seção 8.

| Cenário | O que valida |
|---|---|
| T01 | Sem internet, criar/editar anúncio; fechar e reabrir; dados reaparecem |
| T03 | Interromper gravação local; não existe dado confirmado sem pendência |
| T04 | Servidor aceita mutação, resposta perdida, reenviar; um único resultado lógico |
| T06 | Editar mesmo anúncio em dois aparelhos; política de conflito observável |
| T10 | Negar câmera, conceder nas configurações, voltar; formulário preservado |
| T18 | Como A, tentar ler/alterar dados de B; acesso negado |

---

## 5. Adequar o adapter de sessão segura (recomendado)

Extrair um adapter isolado de sessão segura (tipo `SessionStorageSecureStore`) que encapsule `expo-secure-store`, atualmente embutido no client do Supabase (`client.ts`), para facilitar testes e desacoplar.

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
