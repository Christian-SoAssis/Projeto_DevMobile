import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { SyncAction } from '../../domain/entities/SyncAction';
import { SincronizacaoService } from '../../domain/services/SincronizacaoService';

export interface SyncProcessResult {
  processedCount: number;
  successCount: number;
  failedCount: number;
}

export class ProcessSyncQueueUseCase {
  private isRunning = false;

  constructor(
    private syncQueueRepository: SyncQueueRepository,
    private animalRepository: AnimalRepository,
    private maxAttempts: number = 5
  ) {}

  async execute(): Promise<SyncProcessResult> {
    // Evita duas execuções concorrentes da mesma fila (doc §14.1 passo 2).
    if (this.isRunning) {
      return { processedCount: 0, successCount: 0, failedCount: 0 };
    }

    this.isRunning = true;
    try {
      const pending = await this.syncQueueRepository.listPending();
      let successCount = 0;
      let failedCount = 0;

      for (const action of pending) {
        if (action.status.isFailed() && !SincronizacaoService.shouldRetry(action, this.maxAttempts)) {
          failedCount += 1;
          continue;
        }

        action.markSyncing();
        await this.syncQueueRepository.update(action);

        try {
          await this.applyAction(action);
          action.markCompleted();
          await this.syncQueueRepository.update(action);
          successCount += 1;
        } catch (err: any) {
          action.markFailed(err?.message || 'Erro ao sincronizar item.');
          await this.syncQueueRepository.update(action);
          failedCount += 1;
        }
      }

      await this.syncQueueRepository.clearCompleted();

      return {
        processedCount: pending.length,
        successCount,
        failedCount,
      };
    } finally {
      this.isRunning = false;
    }
  }

  private async applyAction(action: SyncAction): Promise<void> {
    if (action.entityType !== 'animal') {
      throw new Error(
        `Sincronização remota de ${action.entityType} ainda não está disponível na Fase 2.`
      );
    }

    switch (action.operation) {
      case 'CREATE': {
        const animal = await this.animalRepository.findById(action.entityId);
        if (!animal) {
          throw new Error('Registro local do anúncio não encontrado para sincronizar.');
        }
        await this.animalRepository.createRemote(animal);
        return;
      }
      case 'UPDATE':
      case 'MARK_ADOPTED': {
        const animal = await this.animalRepository.findById(action.entityId);
        if (!animal) {
          throw new Error('Registro local do anúncio não encontrado para sincronizar.');
        }
        await this.animalRepository.updateRemote(animal);
        return;
      }
      case 'DELETE':
        // Delete remoto é idempotente: excluir algo já ausente não é erro.
        await this.animalRepository.deleteRemote(action.entityId);
        await this.animalRepository.deleteLocal(action.entityId);
        return;
      default:
        throw new Error(`Operação de sincronização não suportada: ${action.operation}`);
    }
  }
}
