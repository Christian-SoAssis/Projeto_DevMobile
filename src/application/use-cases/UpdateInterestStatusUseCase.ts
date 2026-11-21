import { InterestStage } from '../../domain/entities/AdoptionInterest';
import { SyncAction } from '../../domain/entities/SyncAction';
import { AdoptionInterestRepository } from '../../domain/ports/AdoptionInterestRepository';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { InterestRemoteGateway } from '../../domain/ports/InterestRemoteGateway';
import { RemoteAnimalSource } from '../../domain/ports/RemoteAnimalSource';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';

export class UpdateInterestStatusUseCase {
  constructor(
    private interestRepository: AdoptionInterestRepository,
    private animalRepository: AnimalRepository,
    private syncQueueRepository?: SyncQueueRepository,
    private remoteInterests?: InterestRemoteGateway,
    private remoteAnimalSource?: RemoteAnimalSource
  ) {}

  async execute(
    interestId: string,
    actorUserId: string,
    nextStatus: InterestStage,
    isOnline: boolean = true
  ): Promise<{ synced: boolean; animalMarkedAdopted: boolean }> {
    const interest = await this.interestRepository.findById(interestId);
    if (!interest) {
      throw new Error('Manifestação de interesse não encontrada.');
    }

    const animal = await this.animalRepository.findById(interest.animalId);
    if (!animal || animal.ownerId !== actorUserId) {
      throw new Error('Somente o responsável pelo anúncio pode atualizar a etapa do interesse.');
    }

    // 1. Persiste o novo status do interesse localmente (sempre primeiro)
    interest.transitionTo(nextStatus);
    await this.interestRepository.updateStatus(interest.id, interest.status);

    // 2. Auto-adoção atômica: se CONCLUIDA e animal ainda disponível,
    //    marca o animal como adotado ANTES de qualquer sync remoto para manter consistência.
    let animalMarkedAdopted = false;
    if (nextStatus === 'CONCLUIDA' && animal.status.isAvailable()) {
      const previousVersion = animal.version;
      animal.markAdopted(actorUserId);
      await this.animalRepository.saveLocal(animal);
      animalMarkedAdopted = true;

      // Enfileira MARK_ADOPTED (será processado pelo sync em sequência com o UPDATE de interesse)
      if (this.syncQueueRepository) {
        const adoptAction = new SyncAction({
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
        await this.syncQueueRepository.enqueue(adoptAction);
      }
    }

    // 3. Tenta sync remoto do interesse (online-first, fallback para fila)
    if (isOnline && this.remoteInterests) {
      try {
        await this.remoteInterests.updateStatus(interest.id, interest.status);
        return { synced: true, animalMarkedAdopted };
      } catch (err) {
        await this.enqueueUpdate(interest.id, actorUserId, interest.status, err);
        return { synced: false, animalMarkedAdopted };
      }
    }

    await this.enqueueUpdate(interest.id, actorUserId, interest.status);
    return { synced: false, animalMarkedAdopted };
  }

  private async enqueueUpdate(
    interestId: string,
    actorUserId: string,
    status: InterestStage,
    err?: unknown
  ): Promise<void> {
    if (!this.syncQueueRepository) return;
    const action = new SyncAction({
      id: `sync_interest_status_${interestId}`,
      operation: 'UPDATE',
      entityType: 'interest',
      entityId: interestId,
      payload: {
        id: interestId,
        ownerId: actorUserId,
        status,
      },
    });
    if (err instanceof Error) {
      action.markFailed(err.message);
    }
    await this.syncQueueRepository.enqueue(action);
  }
}
