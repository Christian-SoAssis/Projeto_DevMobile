import { Animal } from '../entities/Animal';

export interface DeltaCursor {
  updatedAt: string;
  id: string;
}

export interface DeltaPage {
  animals: Animal[];
  nextCursor: DeltaCursor | null;
}

export interface TombstoneEntry {
  animalId: string;
  reason: 'DELETED' | 'HIDDEN';
  deletedAt: string;
}

export interface TombstonePage {
  tombstones: TombstoneEntry[];
  nextCursor: DeltaCursor | null;
}

export interface RemoteAnimalSource {
  listVisibleChangedAfter(cursor: DeltaCursor | null, limit?: number): Promise<DeltaPage>;
  listTombstonesAfter?(cursor: DeltaCursor | null, limit?: number): Promise<TombstonePage>;
  findById(id: string): Promise<Animal | null>;
  createRemote(animal: Animal): Promise<Animal>;
  updateRemote(animal: Animal, expectedVersion?: number): Promise<Animal>;
  deleteRemote(animalId: string): Promise<void>;
}
