import { ProcessSyncQueueUseCase, SyncProcessResult } from './ProcessSyncQueueUseCase';
import { PullRemoteAnimalsUseCase, PullResult } from './PullRemoteAnimalsUseCase';

export interface FullSyncResult {
  push: SyncProcessResult;
  /** Ausente quando não há backend configurado ou a leitura falhou. */
  pull?: PullResult;
  pullError?: string;
}

/**
 * Ciclo completo de sincronização (doc §14.1): primeiro as mutações locais
 * sobem (fila), depois o servidor é lido para atualizar o cache. A falha de
 * uma perna não derruba a outra — o usuário vê o que deu certo.
 */
export class RunFullSyncUseCase {
  private running = false;

  constructor(
    private push: ProcessSyncQueueUseCase,
    private pull?: PullRemoteAnimalsUseCase
  ) {}

  async execute(): Promise<FullSyncResult> {
    if (this.running) {
      return { push: { processedCount: 0, successCount: 0, failedCount: 0, conflictCount: 0 } };
    }
    this.running = true;
    try {
      const push = await this.push.execute();
      if (!this.pull) return { push };
      try {
        return { push, pull: await this.pull.execute() };
      } catch (err: any) {
        return { push, pullError: err?.message || 'Falha ao atualizar anúncios do servidor.' };
      }
    } finally {
      this.running = false;
    }
  }
}
