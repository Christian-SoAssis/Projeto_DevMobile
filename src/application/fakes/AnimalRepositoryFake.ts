import { Animal } from '../../domain/entities/Animal';
import { AnimalFilterOptions, AnimalRepository } from '../../domain/ports/AnimalRepository';

export class AnimalRepositoryFake implements AnimalRepository {
  public items: Map<string, Animal> = new Map();
  public isOnline: boolean = true;

  constructor(initialAnimals: Animal[] = []) {
    initialAnimals.forEach((animal) => this.items.set(animal.id, animal));
  }

  async findById(id: string): Promise<Animal | null> {
    return this.items.get(id) || null;
  }

  async search(filters: AnimalFilterOptions): Promise<Animal[]> {
    let result = Array.from(this.items.values());

    if (filters.species) {
      result = result.filter(
        (a) => a.characteristics.species.toLowerCase() === filters.species!.toLowerCase()
      );
    }
    if (filters.size) {
      result = result.filter(
        (a) => a.characteristics.size.toLowerCase() === filters.size!.toLowerCase()
      );
    }
    if (filters.sex) {
      result = result.filter((a) => a.characteristics.sex.toLowerCase() === filters.sex!.toLowerCase());
    }
    if (filters.ownerId) {
      result = result.filter((a) => a.ownerId === filters.ownerId);
    }
    if (filters.status) {
      result = result.filter((a) => a.status.value === filters.status);
    }
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.location.city.toLowerCase().includes(q) ||
          a.location.neighborhood.toLowerCase().includes(q)
      );
    }

    return result;
  }

  async saveLocal(animal: Animal): Promise<void> {
    this.items.set(animal.id, animal);
  }

  async createRemote(animal: Animal): Promise<Animal> {
    if (!this.isOnline) {
      throw new Error('Sem conexão com a internet para criar remotamente.');
    }
    this.items.set(animal.id, animal);
    return animal;
  }

  async updateRemote(animal: Animal): Promise<Animal> {
    if (!this.isOnline) {
      throw new Error('Sem conexão com a internet para atualizar remotamente.');
    }
    this.items.set(animal.id, animal);
    return animal;
  }

  async deleteRemote(id: string): Promise<void> {
    if (!this.isOnline) {
      throw new Error('Sem conexão com a internet para excluir remotamente.');
    }
    this.items.delete(id);
  }

  async listByOwner(ownerId: string): Promise<Animal[]> {
    return this.search({ ownerId });
  }

  async upsertCache(animals: Animal[]): Promise<void> {
    animals.forEach((a) => this.items.set(a.id, a));
  }
}
