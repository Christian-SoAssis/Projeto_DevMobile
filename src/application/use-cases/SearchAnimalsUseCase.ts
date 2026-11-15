import { Animal } from '../../domain/entities/Animal';
import { AnimalRepository, AnimalSearchCriteria } from '../../domain/ports/AnimalRepository';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';

export interface SearchAnimalsOptions extends AnimalSearchCriteria {
  currentUserId?: string | null;
}

/**
 * Consulta e pesquisa de animais (UC01–UC04, RF01–RF05, RF17, RNF01, DAT-10).
 * Filtra rascunhos locais (CREATE pendente) que pertençam a outra conta.
 */
export class SearchAnimalsUseCase {
  constructor(
    private animalRepository: AnimalRepository,
    private syncQueueRepository?: SyncQueueRepository
  ) {}

  async execute(criteria: SearchAnimalsOptions = {}): Promise<Animal[]> {
    const animals = await this.animalRepository.search({
      ...criteria,
      status: criteria.status ?? 'AVAILABLE',
    });

    if (!this.syncQueueRepository) {
      return animals;
    }

    const pendingActions = await this.syncQueueRepository.listPending();
    const foreignDraftAnimalIds = new Set<string>();
    for (const action of pendingActions) {
      if (action.entityType === 'animal' && action.operation === 'CREATE') {
        const actionOwner = action.ownerId;
        if (actionOwner && actionOwner !== criteria.currentUserId) {
          foreignDraftAnimalIds.add(action.entityId);
        }
      }
    }

    if (foreignDraftAnimalIds.size === 0) return animals;
    return animals.filter((a) => !foreignDraftAnimalIds.has(a.id));
  }
}
