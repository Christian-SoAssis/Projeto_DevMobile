import { Animal } from '../entities/Animal';

export interface AnimalFilterOptions {
  species?: string;
  size?: string;
  approximateAge?: string;
  sex?: string;
  searchQuery?: string;
  ownerId?: string;
  status?: string;
}

export interface AnimalRepository {
  findById(id: string): Promise<Animal | null>;
  search(filters: AnimalFilterOptions): Promise<Animal[]>;
  saveLocal(animal: Animal): Promise<void>;
  createRemote(animal: Animal): Promise<Animal>;
  updateRemote(animal: Animal): Promise<Animal>;
  deleteRemote(id: string): Promise<void>;
  listByOwner(ownerId: string): Promise<Animal[]>;
  upsertCache(animals: Animal[]): Promise<void>;
}
