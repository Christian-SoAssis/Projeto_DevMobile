import { InterestStage, INTEREST_PIPELINE_STEPS, pipelineStepsBetween } from '../../domain/entities/AdoptionInterest';
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
    const previousStatus = interest.status;

    // Bloqueia recuo na trilha: não permite voltar a um estágio anterior.
    // RECUSADA tem regras próprias em transitionTo; voltar de RECUSADA para a trilha é permitido.
    const isPipelineStep = (s: InterestStage) => INTEREST_PIPELINE_STEPS.includes(s);
    if (isPipelineStep(previousStatus) && isPipelineStep(nextStatus)) {
      const prevIdx = INTEREST_PIPELINE_STEPS.indexOf(previousStatus);
      const nextIdx = INTEREST_PIPELINE_STEPS.indexOf(nextStatus);
      if (nextIdx < prevIdx) {
        throw new Error('Não é permitido voltar a etapa anterior da trilha de interesse.');
      }
    }

    interest.transitionTo(nextStatus);
    await this.interestRepository.updateStatus(interest.id, interest.status);

    // 2. Auto-adoção atômica: se CONCLUIDA e animal ainda disponível,
    //    marca o animal como adotado ANTES de qualquer sync remoto para manter consistência.
    let animalMarkedAdopted = false;
    let adoptAction: SyncAction | null = null;
    let previousAnimalVersion = animal.version;

    if (nextStatus === 'CONCLUIDA' && animal.status.isAvailable()) {
      previousAnimalVersion = animal.version;
      animal.markAdopted(actorUserId);
      await this.animalRepository.saveLocal(animal);
      animalMarkedAdopted = true;

      // Enfileira MARK_ADOPTED (será removido se o envio imediato online suceder, ou processado pela fila)
      if (this.syncQueueRepository) {
        adoptAction = new SyncAction({
          id: `sync_adopted_${animal.id}_v${animal.version}`,
          operation: 'MARK_ADOPTED',
          entityType: 'animal',
          entityId: animal.id,
          payload: {
            id: animal.id,
            ownerId: animal.ownerId,
            status: 'ADOPTED',
            expectedVersion: previousAnimalVersion,
            version: animal.version,
          },
        });
        await this.syncQueueRepository.enqueue(adoptAction);
      }

      // Se online e com fonte remota de animais, já sincroniza o status ADOPTED imediatamente no servidor
      if (isOnline && this.remoteAnimalSource) {
        try {
          const remoteAdopted = await this.remoteAnimalSource.updateRemote(
            animal,
            previousAnimalVersion
          );
          await this.animalRepository.saveLocal(remoteAdopted);
          if (adoptAction && this.syncQueueRepository) {
            await this.syncQueueRepository.delete(adoptAction.id);
          }
        } catch (err) {
          if (adoptAction && this.syncQueueRepository) {
            adoptAction.markFailed(
              err instanceof Error ? err.message : 'Falha ao sincronizar adoção automática.'
            );
            await this.syncQueueRepository.update(adoptAction);
          }
        }
      }
    }

    // 3. Tenta sync remoto do interesse (online-first, fallback para fila).
    //    Quando há pulo de etapa (ex: ENVIADA -> CONCLUIDA), envia cada etapa
    //    intermediária individualmente para que o servidor aceite a transição,
    //    chegando finalmente ao status alvo. Isso faz com quem manifestou o
    //    interesse veja o status atualizado (ex: "Concluída") em vez de ficar
    //    travado em "Enviada".
    if (isOnline && this.remoteInterests) {
      try {
        await this.syncInterestStatusOnline(interest.id, previousStatus, nextStatus);
        return { synced: true, animalMarkedAdopted };
      } catch (err) {
        await this.enqueueUpdateSteps(interest.id, actorUserId, previousStatus, nextStatus, err);
        return { synced: false, animalMarkedAdopted };
      }
    }

    await this.enqueueUpdateSteps(interest.id, actorUserId, previousStatus, nextStatus);
    return { synced: false, animalMarkedAdopted };
  }

  /**
   * Envia ao servidor remoto cada etapa da trilha do interesse, do status anterior
   * até o status alvo, uma por uma. O servidor aceita cada passo individualmente
   * (ENVIADA -> EM_ANALISE -> VISITA_COMBINADA -> CONCLUIDA), então um pulo de etapa
   * local fica consistente com o remoto.
   */
  private async syncInterestStatusOnline(
    interestId: string,
    previousStatus: InterestStage,
    nextStatus: InterestStage
  ): Promise<void> {
    const steps = pipelineStepsBetween(previousStatus, nextStatus);
    // Cada etapa intermediária é um passo válido que o servidor aceita.
    for (const step of steps) {
      await this.remoteInterests!.updateStatus(interestId, step);
    }
    // Finalmente o status alvo (pode coincidir com a última etapa intermediária se não houver pulo).
    await this.remoteInterests!.updateStatus(interestId, nextStatus);
  }

  private async enqueueUpdateSteps(
    interestId: string,
    actorUserId: string,
    previousStatus: InterestStage,
    nextStatus: InterestStage,
    err?: unknown
  ): Promise<void> {
    if (!this.syncQueueRepository) return;

    const steps = pipelineStepsBetween(previousStatus, nextStatus);
    const allSteps = [...steps, nextStatus];

    // Enfileira uma ação por etapa, com id único incluindo a etapa, para não
    // sobrescrever umas às outras no INSERT OR REPLACE da fila.
    for (const step of allSteps) {
      const action = new SyncAction({
        id: `sync_interest_status_${interestId}_${step}`,
        operation: 'UPDATE',
        entityType: 'interest',
        entityId: interestId,
        payload: {
          id: interestId,
          ownerId: actorUserId,
          status: step,
        },
      });
      // Não marca como falha se for erro de transição do servidor (ex: não aceita recuo ou pulo de etapa).
      // O estado local já foi atualizado; apenas não sincronizou com o remoto.
      if (err instanceof Error && !/transição|transition/i.test(err.message)) {
        action.markFailed(err.message);
      }
      await this.syncQueueRepository.enqueue(action);
    }
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
    // Não marca como falha se for erro de transição do servidor (ex: não aceita recuo ou pulo de etapa).
    // O estado local já foi atualizado; apenas não sincronizou com o remoto.
    if (err instanceof Error && !/transição|transition/i.test(err.message)) {
      action.markFailed(err.message);
    }
    await this.syncQueueRepository.enqueue(action);
  }
}
