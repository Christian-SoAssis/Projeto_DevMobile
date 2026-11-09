import { AdoptionInterest } from '../../domain/entities/AdoptionInterest';
import { SyncAction } from '../../domain/entities/SyncAction';
import { AdoptionInterestRepository } from '../../domain/ports/AdoptionInterestRepository';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { isUuid, newUuid } from '../../domain/services/IdGenerator';
import { UnitOfWork } from '../ports/UnitOfWork';
import { NoopUnitOfWork } from '../fakes/NoopUnitOfWork';

/** Contato do interessado, enviado ao responsável pelo anúncio (doc §15.1). */
export interface InterestContact {
  name?: string;
  email?: string;
  phone?: string;
}

export class RegisterAdoptionInterestUseCase {
  constructor(
    private interestRepository: AdoptionInterestRepository,
    /** Sem fila, o interesse fica só no aparelho (modo demonstração/testes). */
    private syncQueueRepository?: SyncQueueRepository,
    private unitOfWork: UnitOfWork = new NoopUnitOfWork()
  ) {}

  async execute(
    userId: string,
    animalId: string,
    contact: InterestContact = {}
  ): Promise<AdoptionInterest> {
    if (!userId) throw new Error('Usuário deve estar autenticado para demonstrar interesse.');
    if (!animalId) throw new Error('ID do animal é obrigatório.');

    // Id UUID: é a chave primária da tabela `adoption_interests` no servidor.
    const interest = new AdoptionInterest(newUuid(), userId, animalId);

    await this.unitOfWork.run(async () => {
      await this.interestRepository.registerInterest(interest);
      if (this.syncQueueRepository && isUuid(animalId)) {
        await this.syncQueueRepository.enqueue(
          new SyncAction({
            id: `sync_interest_${interest.id}`,
            operation: 'CREATE',
            entityType: 'interest',
            entityId: interest.id,
            payload: {
              id: interest.id,
              userId,
              animalId,
              contactName: contact.name,
              contactEmail: contact.email,
              contactPhone: contact.phone,
              // Decisão 18: trilha começa em ENVIADA no servidor também.
              status: interest.status.value,
              createdAt: interest.createdAt,
            },
          })
        );
      }
    });
    return interest;
  }
}
