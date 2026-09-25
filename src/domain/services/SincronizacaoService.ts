import { SyncAction } from '../entities/SyncAction';

export class SincronizacaoService {
  static shouldRetry(action: SyncAction, maxAttempts: number = 5): boolean {
    return action.status.isFailed() && action.canRetry(maxAttempts);
  }

  static calculateBackoffDelayMs(attempts: number): number {
    return Math.min(1000 * Math.pow(2, attempts), 30000);
  }
}
