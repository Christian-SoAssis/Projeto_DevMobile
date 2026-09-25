import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { SincronizacaoService } from '../../domain/services/SincronizacaoService';

export interface SyncProcessResult {
  processedCount: number;
  successCount: number;
  failedCount: number;
}

export class ProcessSyncQueueUseCase {
  constructor(
    private syncQueueRepository: SyncQueueRepository,
    private animalRepository: AnimalRepository
  ) {}

  async execute(): Promise<SyncProcessResult> {
    const pending = await this.syncQueueRepository.listPending();
    let successCount = 0;
    let failedCount = 0;

    for (const action of pending) {
      action.markSyncing();
      await this.syncQueueRepository.update(action);

      try {
        if (action.entityType === 'animal') {
          if (action.operation === 'CREATE' || action.operation === 'UPDATE' || action.operation === 'MARK_ADOPTED') {
            const animal = await this.animalRepository.findById(action.entityId);
            if (animal) {
              await this.animalRepository.updateRemote(animal);
            }
          } else if (action.operation === 'DELETE') {
            await this.animalRepository.deleteRemote(action.entityId);
          }
        }
        action.markCompleted();
        await this.syncQueueRepository.update(action);
        successCount++;
      } catch (err: any) {
        action.markFailed(err.message || 'Erro ao sincronizar item.');
        await this.syncQueueRepository.update(action);
        failedCount++;
      }
    }

    await this.syncQueueRepository.clearCompleted();

    return {
      processedCount: pending.length,
      successCount,
      failedCount,
    };
  }
}
