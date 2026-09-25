import { SyncAction } from '../../domain/entities/SyncAction';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';

export class DeleteAnimalUseCase {
  constructor(
    private animalRepository: AnimalRepository,
    private syncQueueRepository: SyncQueueRepository
  ) {}

  async execute(requestorId: string, animalId: string, isOnline: boolean): Promise<void> {
    const animal = await this.animalRepository.findById(animalId);
    if (!animal) {
      throw new Error('Anúncio não encontrado.');
    }
    if (!animal.isOwner(requestorId)) {
      throw new Error('Somente o responsável pelo anúncio pode excluí-lo.');
    }

    if (isOnline) {
      try {
        await this.animalRepository.deleteRemote(animalId);
      } catch {
        await this.enqueueDelete(animalId);
      }
    } else {
      await this.enqueueDelete(animalId);
    }
  }

  private async enqueueDelete(animalId: string): Promise<void> {
    const action = new SyncAction({
      id: `sync_delete_${animalId}`,
      operation: 'DELETE',
      entityType: 'animal',
      entityId: animalId,
      payload: { animalId },
    });
    await this.syncQueueRepository.enqueue(action);
  }
}
