import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { AdoptionInterest } from '../../domain/entities/AdoptionInterest';
import { InterestStatus } from '../../domain/value-objects/InterestStatus';
import { AdoptionInterestRepository } from '../../domain/ports/AdoptionInterestRepository';
import { SyncAction } from '../../domain/entities/SyncAction';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { UnitOfWork } from '../ports/UnitOfWork';
import { NoopUnitOfWork } from '../fakes/NoopUnitOfWork';

/**
 * Trilha de adoção (decisão 18 da doc §18): o RESPONSÁVEL move a manifestação
 * pelas etapas ENVIADA → EM ANÁLISE → VISITA COMBINADA → CONCLUÍDA — sem
 * automação (coerente com a decisão 8). RECUSADA existe fora da trilha e
 * só é permitida antes de VISITA_COMBINADA/CONCLUÍDA (a recusa de uma visita
 * combinada/concluída perderia informação que já havia sido confirmada).
 *
 * Local-primeiro + fila: a mudança grava no aparelho e viaja como `SyncAction`
 * UPDATE do tipo `interest` (ProcessSyncQueueUseCase → InterestRemoteGateway).
 */
export class UpdateInterestStatusUseCase {
  constructor(
    private interestRepository: AdoptionInterestRepository,
    /** Sem fila, a mudança fica só no aparelho (modo demonstração/testes). */
    private syncQueueRepository?: SyncQueueRepository,
    private unitOfWork: UnitOfWork = new NoopUnitOfWork(),
    private animals?: AnimalRepository
  ) {}

  async execute(
    interest: AdoptionInterest,
    next: InterestStatus,
    requestorId: string
  ): Promise<AdoptionInterest> {
    if (!interest) throw new Error('Manifestação de interesse é obrigatória.');

    if (
      next.isRecusada() &&
      (interest.status.value === 'VISITA_COMBINADA' || interest.status.isConcluida())
    ) {
      throw new Error(
        'Visita já combinada/concluída não pode ser recusada — converse com o interessado.'
      );
    }

    const animal = await this.animals?.findById(interest.animalId);
    if (!requestorId || !animal || animal.ownerId !== requestorId) throw new Error('Somente o responsável pelo anúncio pode mudar a etapa.');
    if ((!next.isRecusada() && interest.status.nextInTrail()?.value !== next.value) || (next.isRecusada() && interest.status.isRecusada())) throw new Error('Transição de etapa inválida.');
    const changedAt = new Date().toISOString();
    const updated = interest.withStatus(next, changedAt);

    await this.unitOfWork.run(async () => {
      await this.interestRepository.registerInterest(interest);
      await this.interestRepository.updateStatus(interest.id, next, changedAt);
      if (this.syncQueueRepository) {
        await this.syncQueueRepository.enqueue(
          new SyncAction({
            id: `sync_interest_status_${interest.id}_${changedAt}`,
            operation: 'UPDATE',
            entityType: 'interest',
            entityId: interest.id,
            payload: {
              id: interest.id,
              ownerId: requestorId,
              userId: interest.userId,
              animalId: interest.animalId,
              status: next.value,
              updatedAt: changedAt,
            },
          })
        );
      }
    });
    return updated;
  }
}
