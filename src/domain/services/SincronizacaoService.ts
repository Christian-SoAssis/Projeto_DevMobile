import { SyncAction } from '../entities/SyncAction';
import { PERMANENT_SYNC_FAILURE_MARKER } from '../entities/SyncAction';

/**
 * Falha lógica que retry não resolve (o worker para de tentar de imediato).
 * O prefixo `[ERRO PERMANENTE]` vive na entidade `SyncAction` (mesmo
 * padrão do marcador de conflito RF23) e é regravado em `last_error`.
 */
export class PermanentSyncError extends Error {}

export class SincronizacaoService {
  static shouldRetry(action: SyncAction, maxAttempts: number = 5): boolean {
    return action.status.isFailed() && !action.isConflict && action.canRetry(maxAttempts);
  }

  /** Erro PERMANENTE (retry nunca resolve) — por classificação persistida. */
  static isPermanente(lastError?: string): boolean {
    return (lastError ?? '').startsWith(PERMANENT_SYNC_FAILURE_MARKER);
  }

  static calculateBackoffDelayMs(attempts: number): number {
    return Math.min(1000 * Math.pow(2, attempts), 30000);
  }

  /**
   * DAT-11/OFF-05: a re-tentativa obedece ao ESPEÇAMENTO do backoff
   * (2s, 4s … cap 30s) contado do ÚLTIMO momento de falha (`changedAt`
   * é regravado em cada `markFailed`), nunca antes. Conflitos e falhas
   * permanentes retornam `false` (não são retry de fila — revisão/erro
   * lógico), e tentativas esgotadas também.
   */
  static retryIsDue(
    action: SyncAction,
    maxAttempts: number = 5,
    nowMs: number = Date.now()
  ): boolean {
    if (this.isPermanente(action.lastError)) return false;
    if (action.isConflict) return false;
    if (!action.status.isFailed()) return false;
    if (!action.canRetry(maxAttempts)) return false;
    const lastFailure = Date.parse(action.changedAt);
    if (Number.isNaN(lastFailure)) return true;
    return nowMs >= lastFailure + this.calculateBackoffDelayMs(action.attempts);
  }
}
