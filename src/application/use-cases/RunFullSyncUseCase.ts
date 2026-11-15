import { ProcessSyncQueueResult, ProcessSyncQueueUseCase } from './ProcessSyncQueueUseCase';
import { PullRemoteAnimalsUseCase, PullRemoteResult } from './PullRemoteAnimalsUseCase';

export interface FullSyncResult {
  push: ProcessSyncQueueResult;
  pull?: PullRemoteResult;
  skippedConcurrent?: boolean;
}

/**
 * Coordena o ciclo completo Push -> Pull com trava anti-concorrência (OFF-09, §14.1).
 */
export class RunFullSyncUseCase {
  private runningPromise: Promise<FullSyncResult> | null = null;

  constructor(
    private pushUseCase: ProcessSyncQueueUseCase,
    private pullUseCase?: PullRemoteAnimalsUseCase
  ) {}

  async execute(): Promise<FullSyncResult> {
    if (this.runningPromise) {
      return this.runningPromise;
    }

    this.runningPromise = this.runInternal().finally(() => {
      this.runningPromise = null;
    });

    return this.runningPromise;
  }

  private async runInternal(): Promise<FullSyncResult> {
    const push = await this.pushUseCase.execute();
    let pull: PullRemoteResult | undefined;
    if (this.pullUseCase) {
      try {
        pull = await this.pullUseCase.execute();
      } catch {
        // Falha no pull não invalida o resultado do push já concluído
      }
    }
    return { push, pull };
  }
}
