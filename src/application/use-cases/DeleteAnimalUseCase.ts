import { SyncAction } from '../../domain/entities/SyncAction';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { UnitOfWork } from '../ports/UnitOfWork';
import { NoopUnitOfWork } from '../fakes/NoopUnitOfWork';

export class DeleteAnimalUseCase {
  constructor(
    private animalRepository: AnimalRepository,
    private syncQueueRepository: SyncQueueRepository,
    private unitOfWork: UnitOfWork = new NoopUnitOfWork()
  ) {}

  async execute(requestorId: string, animalId: string, isOnline: boolean): Promise<void> {
    const animal = await this.animalRepository.findById(animalId);
    if (!animal) {
      throw new Error('Anúncio não encontrado.');
    }
    if (!animal.isOwner(requestorId)) {
      throw new Error('Somente o responsável pelo anúncio pode excluí-lo.');
    }

    const action = this.buildDeleteAction(animalId);
    await this.unitOfWork.run(async () => {
      await this.animalRepository.deleteLocal(animalId);
      await this.syncQueueRepository.enqueue(action);
    });

    if (isOnline) {
      try {
        await this.animalRepository.deleteRemote(animalId);
        await this.syncQueueRepository.delete(action.id);
      } catch {
        // Mantém a ação na fila para retry.
      }
    }
  }

  private buildDeleteAction(animalId: string): SyncAction {
    return new SyncAction({
      id: `sync_delete_${animalId}`,
      operation: 'DELETE',
      entityType: 'animal',
      entityId: animalId,
      payload: { animalId },
    });
  }
}
