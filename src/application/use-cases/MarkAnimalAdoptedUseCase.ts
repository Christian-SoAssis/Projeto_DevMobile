import { Animal } from '../../domain/entities/Animal';
import { SyncAction } from '../../domain/entities/SyncAction';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { AdoptionInterestRepository } from '../../domain/ports/AdoptionInterestRepository';
import { RemoteAnimalSource } from '../../domain/ports/RemoteAnimalSource';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';

export class MarkAnimalAdoptedUseCase {
  constructor(
    private animalRepository: AnimalRepository,
    private syncQueueRepository: SyncQueueRepository,
    private adoptionInterestRepository: AdoptionInterestRepository,
    private remoteAnimalSource?: RemoteAnimalSource
  ) {}

  async execute(
    animalId: string,
    actorUserId: string,
    isOnline: boolean
  ): Promise<{ animal: Animal; synced: boolean }> {
    const animal = await this.animalRepository.findById(animalId);
    if (!animal) {
      throw new Error('Anúncio não encontrado.');
    }
    const previousVersion = animal.version;
    animal.markAdopted(actorUserId);

    await this.animalRepository.saveLocal(animal);

    const action = new SyncAction({
      id: `sync_adopted_${animal.id}_v${animal.version}`,
      operation: 'MARK_ADOPTED',
      entityType: 'animal',
      entityId: animal.id,
      payload: {
        id: animal.id,
        ownerId: animal.ownerId,
        status: 'ADOPTED',
        expectedVersion: previousVersion,
        version: animal.version,
      },
    });
    await this.syncQueueRepository.enqueue(action);

    if (isOnline && this.remoteAnimalSource) {
      try {
        const remote = await this.remoteAnimalSource.updateRemote(animal, previousVersion);
        await this.animalRepository.saveLocal(remote);
        await this.syncQueueRepository.delete(action.id);
        return { animal: remote, synced: true };
      } catch (err) {
        action.markFailed(err instanceof Error ? err.message : 'Falha ao sincronizar adoção.');
        await this.syncQueueRepository.update(action);
        return { animal, synced: false };
      }
    }

    return { animal, synced: false };
  }

  /** Decisão D4: Reabre um anúncio de "Adotado" de volta para "Disponível" (offline-first). */
  async reopen(
    animalId: string,
    actorUserId: string,
    isOnline: boolean
  ): Promise<{ animal: Animal; synced: boolean }> {
    const animal = await this.animalRepository.findById(animalId);
    if (!animal) {
      throw new Error('Anúncio não encontrado.');
    }
    const previousVersion = animal.version;
    animal.reopenAdoption(actorUserId);

    await this.animalRepository.saveLocal(animal);

    // Decisão D22: ao reabrir a adoção, todas as manifestações de interesse voltam para "ENVIADA"
    const interests = await this.adoptionInterestRepository.listByAnimal(animalId);
    for (const interest of interests) {
      interest.transitionTo('ENVIADA');
      await this.adoptionInterestRepository.updateStatus(interest.id, interest.status);

      // Enfileira atualização do interesse para sincronização remota offline-first
      const action = new SyncAction({
        id: `sync_interest_status_${interest.id}_v${interest.updatedAt}`,
        operation: 'UPDATE',
        entityType: 'interest',
        entityId: interest.id,
        payload: {
          id: interest.id,
          ownerId: interest.userId,
          status: interest.status,
        },
      });
      await this.syncQueueRepository.enqueue(action);
    }

    const action = new SyncAction({
      id: `sync_reopen_${animal.id}_v${animal.version}`,
      operation: 'UPDATE',
      entityType: 'animal',
      entityId: animal.id,
      payload: {
        id: animal.id,
        ownerId: animal.ownerId,
        status: 'AVAILABLE',
        expectedVersion: previousVersion,
        version: animal.version,
      },
    });
    await this.syncQueueRepository.enqueue(action);

    if (isOnline && this.remoteAnimalSource) {
      try {
        const remote = await this.remoteAnimalSource.updateRemote(animal, previousVersion);
        await this.animalRepository.saveLocal(remote);
        await this.syncQueueRepository.delete(action.id);
        return { animal: remote, synced: true };
      } catch (err) {
        action.markFailed(err instanceof Error ? err.message : 'Falha ao reabrir adoção no servidor.');
        await this.syncQueueRepository.update(action);
        return { animal, synced: false };
      }
    }

    return { animal, synced: false };
  }
}
