/**
 * Par chave/valor persistido NO APARELHO (decisão 20 — doc §18): estado de
 * aplicação que sobrevive a reinícios, ex. `notifications_last_seen:<userId>`
 * (central de notificações in-app). Não é dado de domínio — nenhum sync:
 * fica só no aparelho.
 */
export interface AppStateRepository {
  get(key: string): Promise<string | null>;
  /** Upsert: grava valor e a hora da gravação (`app_state.updated_at`). */
  set(key: string, value: string): Promise<void>;
}
