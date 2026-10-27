# Pendências — Enlace

> Lista do que ficou para depois, levantada na revisão de 27/10/2026.
> Ordem: primeiro o que afeta a apresentação da Fase 1 ("Domínio e Interface Primeiro", 100% mock), depois as fases futuras.

## 1. Antes da apresentação (Fase 1)

- [ ] **a) Confirmar com o professor a trilha de estágio.** `docs/criteriosapresentacao1.md` cita `PeriodoAvaliacao`, `Estagio`, `TokenSupervisor`, `Criterio`, `Assinatura`, `CargaHoraria`, `StatusPeriodo`, `useAtividades` e as telas `AssinaturaScreen` / `AtividadesFormScreen` / `HistoricoRelatoriosScreen`. Essa trilha foi removida do código (commit `75bce6c`). Confirmar se a trilha de adoção substitui o exemplo de estágio na avaliação. **Decisão da equipe/professor — não implementar por suposição.**
- [ ] **b) SQLite fora da Fase 1.** Os critérios (§5) proíbem `expo-sqlite` nesta fase, mas ele está no `package.json` e existe `src/infrastructure/database/sqlite/` (não usado pelas telas). Opções: remover o pacote e guardar o código para a Fase 2, ou justificar na apresentação que existe mas está desligado.
- [ ] **c) Atualizar `docs/nextsteps.md`.** Ainda cita "128/128 testes", a trilha de estágio e `useAtividades`. Números atuais: 136 testes, ~95% de linhas e ~83% de ramos cobertos.
- [ ] **d) Modo offline acionável pela interface.** Nenhuma rota passa `isOnline`/`isOnlineInitial`, então a fila de sincronização não pode ser demonstrada no app. Sugestão: botão "Simular offline" (ex.: na aba Sync) usado por busca, criação, edição, exclusão e marcar adotado.
- [ ] **e) Ajustes pequenos:**
  - [ ] Conferir em celular real se os rótulos das abas ficam cortados (`app/(tabs)/_layout.tsx`, `height: 60`).
  - [ ] Remover o `Alert` importado e não usado em `AnimalDetailsScreen.tsx` e `AnimalFormScreen.tsx`.
  - [ ] Corrigir o aviso de `act(...)` do `SyncStatusScreen` nos testes.
  - [ ] Mover ou remover `salvarcomoadotado.png` da raiz do projeto.

## 2. Fases futuras (detalhes em `docs/nextsteps.md` §3)

| Fase | Conteúdo |
|---|---|
| 2 | SQLite real: cache e fila persistem após fechar o app |
| 3 | Supabase: autenticação real, banco, upload de fotos, RLS |
| 4 | Dispositivo real: `expo-secure-store`, câmera, localização, detecção de conexão (`CameraGatewayExpo` e `SessionStorageSecureStore` hoje só simulam) |
| 6 | Sincronização completa: retry, resolução de conflitos, moderação |
| 7–8 | Desempenho e E2E restantes (5 de 8 verdes) |

Antes dessas fases, decidir os 13 bloqueadores de produto de `docs/nextsteps.md` §4 (método de login, limite de fotos, reabrir anúncio adotado, visibilidade do contato etc.).

## Já feito nesta revisão (referência)

- Login e cadastro ligados ao `AuthContext`; rotas usam o usuário logado; `(protected)` redireciona para `/login`.
- Exclusão offline remove o anúncio localmente; sincronização usa `createRemote` para CREATE e não perde itens em silêncio.
- Abas Meus anúncios e Sync atualizam ao ganhar foco; fotos exibidas com placeholder; "voltar" retorna à tela de origem.
- Suporte web removido: app somente iOS/Android (pedido do professor).
