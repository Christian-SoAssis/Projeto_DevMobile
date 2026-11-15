import { InterestStage } from '../../domain/entities/AdoptionInterest';
import { SyncAction } from '../../domain/entities/SyncAction';
import { AdoptionInterestRepository } from '../../domain/ports/AdoptionInterestRepository';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { InterestRemoteGateway } from '../../domain/ports/InterestRemoteGateway';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';

export class UpdateInterestStatusUseCase {
  constructor(
    private interestRepository: AdoptionInterestRepository,
    private animalRepository: AnimalRepository,
    private syncQueueRepository?: SyncQueueRepository,
    private remoteInterests?: InterestRemoteGateway
  ) {}

  async execute(
    interestId: string,
    actorUserId: string,
    nextStatus: InterestStage,
    isOnline: boolean = true
  ): Promise<{ synced: boolean }> {
    const interest = await this.interestRepository.findById(interestId);
    if (!interest) {
      throw new Error('Manifestação de interesse não encontrada.');
    }

    const animal = await this.animalRepository.findById(interest.animalId);
    if (!animal || animal.ownerId !== actorUserId) {
      throw new Error('Somente o responsável pelo anúncio pode atualizar a etapa do interesse.');
    }

    interest.transitionTo(nextStatus);
    await this.interestRepository.updateStatus(interest.id, interest.status);

    if (isOnline && this.remoteInterests) {
      try {
        await this.remoteInterests.updateStatus(interest.id, interest.status);
        return { synced: true };
      } catch (err) {
        await this.enqueueUpdate(interest.id, actorUserId, interest.status, err);
        return { synced: false };
      }
    }

    await this.enqueueUpdate(interest.id, actorUserId, interest.status);
    return { synced: false };
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
