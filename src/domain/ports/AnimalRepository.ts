import { Animal } from '../entities/Animal';
import { AdoptionStatusType } from '../value-objects/AdoptionStatus';

export interface AnimalSearchCriteria {
  query?: string;
  species?: string;
  size?: string;
  approximateAge?: string;
  sex?: string;
  status?: AdoptionStatusType;
  ownerId?: string;
  latitude?: number;
  longitude?: number;
  maxDistanceKm?: number;
  includeHidden?: boolean;
}

export interface AnimalRepository {
  search(criteria?: AnimalSearchCriteria): Promise<Animal[]>;
  findById(id: string): Promise<Animal | null>;
  findByOwner(ownerId: string): Promise<Animal[]>;
  saveLocal(animal: Animal): Promise<void>;
  upsertCache(animals: Animal[]): Promise<void>;
  deleteLocal(id: string): Promise<void>;
}
