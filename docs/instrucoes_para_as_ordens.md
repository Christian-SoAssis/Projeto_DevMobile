# Instruções para as ordens pendentes (ordens 0, 2, 6 e 8)

> **Fase da revisão:** as ordens que **não dependem de decisão de produto** já foram
> implementadas e commitadas — ordens 1 e 3 (`f7caf44`), ordem 4 (`280924d`),
> ordem 5 (`3242c42`), ordem 7 (`5266da0`). Suíte final: **428/428 verdes (66
> suítes)**, typecheck 0 erros (registro completo em `nextsteps_arquitetura.md` §7).
>
> Este documento existe para apoiar a **decisão** das ordens 🔒 (0, 2, 6) e a
> execução da ordem 🌐 (8). Nenhuma delas deve ser implementada sem a escolha
> registrada neste arquivo.

---

## ✅ Decisões registradas (06/11/2026, pelo responsável)

| Ordem | Decisão | Consequência implementada |
|---|---|---|
| **0** | **Opção (a) — preservar e pausar.** Trocar de conta não apaga nada; as pendências de cada conta ficam paradas enquanto outra conta está logada e voltam a subir quando o dono entra de novo. Sem aviso no logout (nada é descartado). | Base da ordem 2. |
| **2** | Implementada conforme a ordem 0 (pausar, não limpar). | O dono de cada ação vai no payload (`ownerId`/`userId`), e o worker só envia as ações da sessão ativa. A tela de Sync e a busca escondem pendências e rascunhos de outra conta. |
| **6** | **Cursor/delta** (e não a confirmação do snapshot). | Keyset `(updated_at, id)` com relógio do servidor, mais a tabela `animal_tombstones` para anúncios apagados ou ocultados. A 1ª sincronização baixa tudo; as seguintes baixam só o que mudou. |

Detalhes de implementação, testes e limitações: `nextsteps_arquitetura.md` §7.
O texto abaixo é mantido como registro das opções que foram avaliadas.

---

## 🔒 Ordem 0 — Política de troca de conta (regra DAT-10)

**Cenário:** o usuário desloga da conta B e entra na conta A no mesmo aparelho.
O que acontece com os dados locais (cache SQLite, fila de sincronização, favoritos)?

### Opção (a) — Preservar e retomar no login de B
- **Ganha:** UX rápida de volta; **nenhum** trabalho offline se perde (edições
  offline da conta B sobem no próximo login dela).
- **Arrisca:** dados **privados** de B (favoritos, interesses, itens da fila) ficam
  visíveis/atuantes enquanto A usa o app. A tela de favoritos de A pode exibir
  favoritos de B; o worker pode tentar **enviar as ações de B sob a sessão de A** —
  o servidor recusa (RLS), mas a fila enche de falhas falsas.
- **Implicação em código:** exige a ordem 2 junto (tag de dono + filtro por
  sessão), senão o problema acima acontece de verdade.

### Opção (b) — Limpar com aviso no logout
- **Ganha:** isolamento limpo — cada login começa num estado consistente para o
  dono da sessão. Privacidade por construção.
- **Custa/doe:** tudo pendente **não sincronizado** da B é descartado (edições
  offline, CREATE de anúncio offline, fotos em fila). Isso esbarra na regra "sem
  perda silenciosa" (RNF02/RNF03) — por isso o **aviso no logout**: "há N
  alterações não sincronizadas; serão descartadas", dando chance de sincronizar
  antes de sair.
- **Implicação em código:** rotina de wipe no logout + tela de aviso; a ordem 2
  continua recomendada como defesa (sessão expirada, troca após crash).

### Opção (c) — Caminho intermediário: limpar só o privado, preservar o público
- Limpar **apenas** dados privados (favoritos/interesses/fila da conta) e
  preservar o **cache público** (anúncios são visíveis a qualquer pessoa, mesmo
  offline — não é vazamento).
- Menos perda de trabalho que (b), menos vazamento que (a). Bom custo×benefício
  se a troca de conta for caso raro.
- **Implicação em código:** rotina de limpeza seletiva por "dono do dado" + a
  ordem 2 (filtro por sessão no worker).

### Perguntas para decidir
1. Qual o risco mais relevante: **perder trabalho offline** (favorece preservar)
   ou **misturar dados privados entre contas** (favorece limpar)?
2. Quanta fricção você aceita no logout (aviso de pendências)?
3. Troca de conta será frequente ou caso raro? Caso raro → (c) tende a ser a
   melhor relação custo×benefício.

---

## 🔒 Ordem 2 — Worker ignora ações de outra conta (DAT-10)

**O que é:** marcar cada item da fila com a tag "de quem é" e o worker processar
**só** o que é da sessão atual.

**Implicação se NÃO fizer (estado atual):**
- Favoritos/interesses levam `user_id` no payload → enviados sob A, o servidor
  recusa (RLS) → itens viram falha permanente (com a ordem 7, param de tentar
  para sempre — "poeira" na fila).
- Ações de **anúncios** não levam usuário no payload → enviadas sob A seriam
  **aceitas e atribuídas a A** (edições que B fez, assinadas por A). É o
  cenário de pior gravidade.

**Custo do trabalho:** pequeno, **sem migration** — a tag de dono entra nos props
do `SyncAction`/payload, o worker filtra por sessão, mais 2–3 testes (cenário
DAT-10 do checklist).

**Dependência:** a forma da implementação (pausar itens alheios vs. limpar) é
definida 100% pela ordem 0. Não implementar antes.

---

## 🔒 Ordem 6 — Confirmar OFF-06: pull por snapshot integral (sem cursor/delta)

**Estado atual:** a cada sincronização o app baixa **todos** os anúncios
visíveis e reconcilia pelo `version`. Não existe cursor "me mande só o que
mudou desde X".

### Confirmar snapshot (recomendado)
- **Por que é aceitável:** dataset pequeno; reconciliação por versão já resolve
  duplicação/defasagem; não exige nada no servidor (sem `updated_at` indexado,
  sem tombstones para apagados); código simples e coberto por testes.
- **O que essa decisão fecha:** reclamação futura de performance no pull
  **reabre** o item — não é corrigido de graça.

### Se, em vez disso, quiser cursor/delta (cenário grande)
- Precisa de rastreamento de mudança no servidor (`updated_at` + índice),
  paginação, e tratamento de **exclusões** (sem tombstone, um anúncio apagado
  nunca "chega" como delta). Trabalho substancial no servidor e no repo remoto.
- Para o escopo atual, snapshot é a escolha racional.

**Custo de confirmar:** nenhum código — apenas registrar a decisão aqui e no
`06-checklist-de-revisao.md`.

---

## 🌐 Ordem 8 — Validações em ambiente real (T10/T18/T20/T22)

**O que é:** itens que só podem ser provados com infraestrutura **fora do código**:

1. **Criar projeto Supabase real** → aplicar o `init.sql` (tabelas + políticas
   RLS) e definir `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
2. **Aparelho físico com build próprio** (Expo Go não basta para o
   comportamento nativo).

**O que só ali fica provado:**
- **RLS de verdade** (DAT-05..07): hoje as políticas são verificadas por leitura
  do SQL, não aplicadas — erro de política = dados vazando ou bloqueio.
- **T18/T22** (fluxo real de rede/sessão), **EXIF** e permissões de
  câmera/galeria no build próprio.
- O caminho da **ordem 5** (`PhotoCopyError`) só se prova de verdade em device —
  aqui roda com FileSystem injetado (ver `SqlitePhotoStorage.ts`).
- Banco real: SQLite nativo vs. emulador de memória — já mostraram divergências
  (caso da ordem 3, filtro SQL avançado).

**Risco de não fazer:** as garantias de hoje são "verde em Jest"; algumas podem
questionar no primeiro contato com o real. Não é trabalho de código — é
configuração + homologação.

---

## Resumo das dependências

| Ordem | Bloqueia | Dependência |
|---|---|---|
| 0 🔒 | define a forma da **2** | decisão do responsável (a, b ou c) |
| 2 🔒 | — | **= ordem 0** |
| 6 🔒 | — | decisão leve — só confirmar |
| 8 🌐 | — | projeto Supabase + aparelho físico (ação operacional) |

**Estado ao registrar este arquivo:** suíte **428/428**, typecheck 0 erros,
Working tree limpo. Ordens 1/3 (`f7caf44`), 4 (`280924d`), 5 (`3242c42`),
7 (`5266da0`) concluídas — referências em `nextsteps_arquitetura.md`.
