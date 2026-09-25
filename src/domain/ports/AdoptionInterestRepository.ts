import { AdoptionInterest } from '../entities/AdoptionInterest';

export interface AdoptionInterestRepository {
  registerInterest(interest: AdoptionInterest): Promise<void>;
  listByUser(userId: string): Promise<AdoptionInterest[]>;
  listByAnimal(animalId: string): Promise<AdoptionInterest[]>;
  hasInterest(userId: string, animalId: string): Promise<boolean>;
}
