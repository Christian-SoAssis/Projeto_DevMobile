import { Animal } from '../../domain/entities/Animal';
import { AnimalFilterOptions, AnimalRepository } from '../../domain/ports/AnimalRepository';

export interface SearchAnimalsOutput {
  animals: Animal[];
  isOffline: boolean;
}

export class SearchAnimalsUseCase {
  constructor(private animalRepository: AnimalRepository) {}

  async execute(filters: AnimalFilterOptions, isOnline: boolean = true): Promise<SearchAnimalsOutput> {
    const cached = await this.animalRepository.search(filters);

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
}
