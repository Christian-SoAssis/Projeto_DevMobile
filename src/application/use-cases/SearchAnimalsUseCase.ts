import { Animal } from '../../domain/entities/Animal';
import { AnimalFilterOptions, AnimalRepository } from '../../domain/ports/AnimalRepository';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { SearchRadius } from '../../domain/value-objects/SearchRadius';

export interface SearchAnimalsOutput {
  animals: Animal[];
  isOffline: boolean;
}

/**
 * DAT-10 (ordens 0/2, cenário T19): um anúncio criado offline por A e ainda
 * não publicado (CREATE na fila) é RASCUNHO de A — B não o vê na busca do
 * mesmo aparelho. Nada é apagado (política "preservar e pausar"); quando A
 * entra de novo, o rascunho reaparece e sobe.
 */
export interface SearchIsolation {
  syncQueueRepository: SyncQueueRepository;
  /** `undefined` = sessão desconhecida (sem filtro); `null` = ninguém logado. */
  currentUserId: () => string | null | undefined;
}

export class SearchAnimalsUseCase {
  constructor(
    private animalRepository: AnimalRepository,
    private isolation?: SearchIsolation
  ) {}

  async execute(filters: AnimalFilterOptions, isOnline: boolean = true): Promise<SearchAnimalsOutput> {
    const validated = SearchAnimalsUseCase.withValidatedRadius(filters);
    const cached = await this.hideForeignDrafts(await this.animalRepository.search(validated));

    if (!isOnline) {
      return { animals: cached, isOffline: true };
    }

    try {
      // In real scenario, fetches remote and updates cache
      return { animals: cached, isOffline: false };
    } catch {
      return { animals: cached, isOffline: true };
    }
  }

  private async hideForeignDrafts(animals: Animal[]): Promise<Animal[]> {
    if (!this.isolation) return animals;
    const session = this.isolation.currentUserId();
    if (session === undefined) return animals;
    const pending = await this.isolation.syncQueueRepository.listPending();
    const drafts = new Set(
      pending
        .filter((a) => a.entityType === 'animal' && a.operation === 'CREATE')
        .map((a) => a.entityId)
    );
    if (drafts.size === 0) return animals;
    return animals.filter((animal) => !drafts.has(animal.id) || animal.ownerId === session);
  }

  /**
   * RF04: o raio informado é normalizado pelo VO da decisão de produto
   * (`SearchRadius`, 0–10 km). Valor fora da faixa (ex.: linha antiga de
   * preferências gravada antes da validação) degrada SEM filtro de
   * distância — a busca do visitante nunca quebra; a recusa dura já
   * acontece na gravação das preferências, e filtro de consulta não é
   * mutação (não há perda silenciosa de dado aqui).
   */
  static withValidatedRadius(filters: AnimalFilterOptions): AnimalFilterOptions {
    if (filters.radiusKm === undefined) return filters;
    try {
      return { ...filters, radiusKm: SearchRadius.from(filters.radiusKm)?.valueKm };
    } catch {
      return { ...filters, radiusKm: undefined };
    }
  }
}
