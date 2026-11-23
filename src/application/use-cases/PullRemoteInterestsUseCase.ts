import { Animal } from '../../domain/entities/Animal';
import { AdoptionInterest } from '../../domain/entities/AdoptionInterest';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { AdoptionInterestRepository } from '../../domain/ports/AdoptionInterestRepository';
import { AppStateRepository } from '../../domain/ports/AppStateRepository';
import { InterestRemoteGateway } from '../../domain/ports/InterestRemoteGateway';
import { InterestWithdrawalRecorder } from '../../domain/ports/InterestWithdrawalRecorder';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { AppStateInterestWithdrawalRecorder } from '../../domain/services/InterestWithdrawalService';

export interface PullRemoteInterestsOptions {
  currentUserId: () => string | null;
  withdrawalRecorder?: InterestWithdrawalRecorder;
}

export interface PullRemoteInterestsResult {
  upserted: number;
  removed: number;
  withdrawals: number;
  skippedPending: number;
  failedRequests: number;
}

export interface SyncAnimalInterestsResult {
  interests: AdoptionInterest[];
  withdrawalDetected: boolean;
}

/**
 * Atualiza o cache local com os interesses enviados pelo usuário ativo e os
 * recebidos nos anúncios dele. Alterações ainda na outbox são preservadas.
 * Depende exclusivamente de portas e serviços da camada de domínio.
 */
export class PullRemoteInterestsUseCase {
  private readonly withdrawalRecorder: InterestWithdrawalRecorder;

  constructor(
    private remoteInterests: InterestRemoteGateway,
    private interestRepository: AdoptionInterestRepository,
    private animalRepository: AnimalRepository,
    private syncQueueRepository: SyncQueueRepository,
    appStateRepository: AppStateRepository,
    private options: PullRemoteInterestsOptions
  ) {
    this.withdrawalRecorder =
      options.withdrawalRecorder ?? new AppStateInterestWithdrawalRecorder(appStateRepository);
  }

  async execute(): Promise<PullRemoteInterestsResult> {
    const userId = this.options.currentUserId();
    if (!userId) {
      return { upserted: 0, removed: 0, withdrawals: 0, skippedPending: 0, failedRequests: 0 };
    }

    const [pendingActions, ownedAnimals] = await Promise.all([
      this.syncQueueRepository.listPending(),
      this.animalRepository.findByOwner(userId),
    ]);
    const pendingInterestIds = new Set(
      pendingActions
        .filter((action) => action.entityType === 'interest')
        .map((action) => action.entityId)
    );

    const [localReceived, results] = await Promise.all([
      Promise.all(ownedAnimals.map((animal) => this.interestRepository.listByAnimal(animal.id))),
      Promise.allSettled([
        this.remoteInterests.listByUser(userId),
        ...ownedAnimals.map((animal) => this.remoteInterests.listByAnimal(animal.id)),
      ]),
    ]);

    const interests = new Map<string, AdoptionInterest>();
    let failedRequests = 0;
    for (const result of results) {
      if (result.status === 'rejected') {
        failedRequests += 1;
        continue;
      }
      for (const interest of result.value) interests.set(interest.id, interest);
    }

    let upserted = 0;
    let skippedPending = 0;
    for (const interest of interests.values()) {
      if (pendingInterestIds.has(interest.id)) {
        skippedPending += 1;
        continue;
      }
      await this.interestRepository.save(interest);
      upserted += 1;
    }

    let removed = 0;
    let withdrawals = 0;
    for (let index = 0; index < ownedAnimals.length; index += 1) {
      // A consulta daquele anúncio falhou: o cache continua sendo a melhor fonte disponível.
      const receivedResult = results[index + 1];
      if (receivedResult?.status !== 'fulfilled') continue;

      const remoteIds = new Set(receivedResult.value.map((interest) => interest.id));
      for (const localInterest of localReceived[index]) {
        if (remoteIds.has(localInterest.id) || pendingInterestIds.has(localInterest.id)) continue;

        await this.interestRepository.remove(localInterest.id);
        await this.withdrawalRecorder.record(userId, ownedAnimals[index].name, localInterest);
        removed += 1;
        withdrawals += 1;
      }
    }

    return { upserted, removed, withdrawals, skippedPending, failedRequests };
  }

  /**
   * Sincroniza e mescla os interesses de um único anúncio com o servidor,
   * preservando ações pendentes na outbox e detectando desistências para o responsável.
   */
  async syncForAnimal(
    animal: Animal,
    currentUserId: string | null,
    isOnline: boolean = true
  ): Promise<SyncAnimalInterestsResult> {
    const localList = await this.interestRepository.listByAnimal(animal.id);
    if (!isOnline) {
      return { interests: localList, withdrawalDetected: false };
    }

    try {
      const [remoteList, pendingActions] = await Promise.all([
        this.remoteInterests.listByAnimal(animal.id),
        this.syncQueueRepository.listPending(),
      ]);

      const pendingInterestIds = new Set(
        pendingActions
          .filter((action) => action.entityType === 'interest')
          .map((action) => action.entityId)
      );

      const map = new Map<string, AdoptionInterest>();
      for (const item of localList) {
        map.set(item.id, item);
      }

      let withdrawalDetected = false;
      if (currentUserId && currentUserId === animal.ownerId) {
        const remoteIds = new Set(remoteList.map((item) => item.id));
        for (const localInterest of localList) {
          if (remoteIds.has(localInterest.id) || pendingInterestIds.has(localInterest.id)) {
            continue;
          }
          await this.interestRepository.remove(localInterest.id);
          await this.withdrawalRecorder.record(currentUserId, animal.name, localInterest);
          map.delete(localInterest.id);
          withdrawalDetected = true;
        }
      }

      for (const remoteItem of remoteList) {
        if (pendingInterestIds.has(remoteItem.id)) {
          continue;
        }
        map.set(remoteItem.id, remoteItem);
        await this.interestRepository.save(remoteItem);
      }

      return {
        interests: Array.from(map.values()),
        withdrawalDetected,
      };
    } catch {
      return { interests: localList, withdrawalDetected: false };
    }
  }
}
