import { SyncAction } from '../../domain/entities/SyncAction';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { RemoteAnimalSource } from '../../domain/ports/RemoteAnimalSource';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';

export class DeleteAnimalUseCase {
  constructor(
    private animalRepository: AnimalRepository,
    private syncQueueRepository: SyncQueueRepository,
    private remoteAnimalSource?: RemoteAnimalSource
  ) {}

  async execute(animalId: string, actorUserId: string, isOnline: boolean): Promise<boolean> {
    const existing = await this.animalRepository.findById(animalId);
    if (!existing) {
      throw new Error('Anúncio não encontrado.');
    }
    if (existing.ownerId !== actorUserId) {
      throw new Error('Somente o responsável pode excluir este anúncio.');
    }

    await this.animalRepository.deleteLocal(animalId);

    const action = new SyncAction({
      id: `sync_delete_${animalId}`,
      operation: 'DELETE',
      entityType: 'animal',
      entityId: animalId,
      payload: {
        id: animalId,
        ownerId: actorUserId,
      },
    });
    await this.syncQueueRepository.enqueue(action);

    if (isOnline && this.remoteAnimalSource) {
      try {
        await this.remoteAnimalSource.deleteRemote(animalId);
        await this.syncQueueRepository.delete(action.id);
        return true;
      } catch (err) {
        action.markFailed(err instanceof Error ? err.message : 'Falha ao excluir no servidor.');
        await this.syncQueueRepository.update(action);
        return false;
      }
    }

    return false;
  }
}
