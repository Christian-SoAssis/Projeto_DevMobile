import { AdoptionInterest } from '../../domain/entities/AdoptionInterest';
import { SyncAction } from '../../domain/entities/SyncAction';
import { AdoptionInterestRepository } from '../../domain/ports/AdoptionInterestRepository';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { InterestRemoteGateway } from '../../domain/ports/InterestRemoteGateway';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';

export interface RegisterInterestInput {
  userId: string;
  userName?: string;
  userEmail?: string;
  animalId: string;
  message?: string;
  contactInfo?: string;
  isOnline?: boolean;
}

export class RegisterAdoptionInterestUseCase {
  constructor(
    private interestRepository: AdoptionInterestRepository,
    private animalRepository: AnimalRepository,
    private syncQueueRepository?: SyncQueueRepository,
    private remoteInterests?: InterestRemoteGateway
  ) {}

  async execute(input: RegisterInterestInput): Promise<{ interest: AdoptionInterest; synced: boolean }> {
    if (!input.userId) {
      throw new Error('Faça login para demonstrar interesse em adotar.');
    }

    const animal = await this.animalRepository.findById(input.animalId);
    if (!animal) {
      throw new Error('Anúncio não encontrado.');
    }
    if (!animal.status.isAvailable()) {
      throw new Error('Este animal já foi adotado.');
    }

    const interest = new AdoptionInterest({
      userId: input.userId,
      userName: input.userName,
      userEmail: input.userEmail,
      animalId: input.animalId,
      message: input.message || 'Tenho interesse em adotar este pet!',
      contactInfo: input.contactInfo || input.userEmail || '',
      status: 'ENVIADA',
    });

    await this.interestRepository.save(interest);

    const isOnline = input.isOnline ?? true;
    if (isOnline && this.remoteInterests) {
      try {
        await this.remoteInterests.upsert(interest);
        return { interest, synced: true };
      } catch (err) {
        await this.enqueueInterest(interest, err);
        return { interest, synced: false };
      }
    }

    await this.enqueueInterest(interest);
    return { interest, synced: false };
  }

  /** Decisões D7 e D9: Permite ao próprio interessado cancelar/retirar sua manifestação (offline-first). */
  async cancel(
    interestId: string,
    actorUserId: string,
    isOnline: boolean = true
  ): Promise<{ synced: boolean }> {
    const existing = await this.interestRepository.findById(interestId);
    if (!existing) {
      throw new Error('Manifestação de interesse não encontrada.');
    }
    if (existing.userId !== actorUserId) {
      throw new Error('Somente o próprio interessado pode cancelar sua manifestação.');
    }

    await this.interestRepository.remove(interestId);

    if (isOnline && this.remoteInterests) {
      try {
        await this.remoteInterests.remove(interestId);
        return { synced: true };
      } catch (err) {
        await this.enqueueCancelInterest(interestId, actorUserId, err);
        return { synced: false };
      }
    }

    await this.enqueueCancelInterest(interestId, actorUserId);
    return { synced: false };
  }

  private async enqueueCancelInterest(
    interestId: string,
    actorUserId: string,
    err?: unknown
  ): Promise<void> {
    if (!this.syncQueueRepository) return;
    const action = new SyncAction({
      id: `sync_interest_delete_${interestId}`,
      operation: 'DELETE',
      entityType: 'interest',
      entityId: interestId,
      payload: {
        id: interestId,
        ownerId: actorUserId,
        userId: actorUserId,
      },
    });
    if (err instanceof Error) {
      action.markFailed(err.message);
    }
    await this.syncQueueRepository.enqueue(action);
  }

  private async enqueueInterest(interest: AdoptionInterest, err?: unknown): Promise<void> {
    if (!this.syncQueueRepository) return;
    const action = new SyncAction({
      id: `sync_interest_create_${interest.id}`,
      operation: 'CREATE',
      entityType: 'interest',
      entityId: interest.id,
      payload: {
        id: interest.id,
        ownerId: interest.userId,
        userId: interest.userId,
        animalId: interest.animalId,
        message: interest.message,
        contactInfo: interest.contactInfo,
        status: interest.status,
      },
    });
    if (err instanceof Error) {
      action.markFailed(err.message);
    }
    await this.syncQueueRepository.enqueue(action);
  }
}
