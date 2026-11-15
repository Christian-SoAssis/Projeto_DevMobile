import { Animal } from '../../domain/entities/Animal';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { RemoteAnimalSource } from '../../domain/ports/RemoteAnimalSource';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';

export type ConflictChoice = 'KEEP_LOCAL' | 'USE_REMOTE';

/**
 * Resolução explícita de conflito pelo responsável (UC18, V14, RF23, RNF03).
 */
export class ResolveSyncConflictUseCase {
  constructor(
    private animalRepository: AnimalRepository,
    private syncQueueRepository: SyncQueueRepository,
    private remoteAnimalSource?: RemoteAnimalSource
  ) {}

  async execute(
    animalId: string,
    choice: ConflictChoice
  ): Promise<Animal> {
    const local = await this.animalRepository.findById(animalId);
    const remote = this.remoteAnimalSource
      ? await this.remoteAnimalSource.findById(animalId)
      : null;

    if (choice === 'USE_REMOTE') {
      if (!remote) {
        throw new Error('Versão online não disponível no momento.');
      }
      await this.animalRepository.saveLocal(remote);
      await this.clearPendingForAnimal(animalId);
      return remote;
    }

    if (!local) {
      throw new Error('Versão local não encontrada.');
    }

    if (this.remoteAnimalSource) {
      const pushed = await this.remoteAnimalSource.updateRemote(local);
      await this.animalRepository.saveLocal(pushed);
      await this.clearPendingForAnimal(animalId);
      return pushed;
    }

    await this.clearPendingForAnimal(animalId);
    return local;
  }

  private async clearPendingForAnimal(animalId: string): Promise<void> {
    const pending = await this.syncQueueRepository.listPending();
    for (const action of pending) {
      if (action.entityType === 'animal' && action.entityId === animalId) {
        await this.syncQueueRepository.delete(action.id);
      }
    }
  }
}
