import { SyncAction } from '../../domain/entities/SyncAction';

/**
 * Conta da sessão ativa vista pela sincronização (DAT-10, ordens 0/2).
 *
 * Política decidida na ordem 0: PRESERVAR e PAUSAR. Trocar de conta no
 * aparelho não apaga nada; o worker apenas deixa de enviar as ações de
 * outra conta, que retomam quando o dono entrar de novo.
 *
 * Mesmo padrão de `pullEvents`: estado leve da camada de adapters,
 * publicado pelo `AuthProvider` e lido pelos ciclos de sync — a camada
 * `application` recebe só um provedor (`CurrentUserIdProvider`).
 *
 * Estados:
 *  - `undefined` → nenhum `AuthProvider` montado (testes/legado): sem filtro;
 *  - `null`      → provider montado e ninguém logado (ou sessão carregando):
 *                  toda ação com dono fica pausada;
 *  - `string`    → id da conta logada.
 */
let activeUserId: string | null | undefined;

export function publishActiveUserId(userId: string | null): void {
  activeUserId = userId;
}

/** Desmontagem do `AuthProvider`: volta ao estado "sessão desconhecida". */
export function resetActiveUserId(): void {
  activeUserId = undefined;
}

export function getActiveUserId(): string | null | undefined {
  return activeUserId;
}

/**
 * Filtro de exibição (tela de Sync): esconde pendências de outra conta.
 * Item sem dono gravado (legado) continua visível — mesmo critério do
 * worker, que não consegue atribuí-lo sem consultar o anúncio.
 */
export function isVisibleToActiveSession(action: SyncAction): boolean {
  const session = activeUserId;
  if (session === undefined) return true;
  const owner = action.ownerId;
  if (!owner) return true;
  return session !== null && owner === session;
}
