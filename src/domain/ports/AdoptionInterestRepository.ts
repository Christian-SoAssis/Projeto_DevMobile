import { AdoptionInterest, InterestStage } from '../entities/AdoptionInterest';

export interface AdoptionInterestRepository {
  save(interest: AdoptionInterest): Promise<void>;
  findById(id: string): Promise<AdoptionInterest | null>;
  listByUser(userId: string): Promise<AdoptionInterest[]>;
  listByAnimal(animalId: string): Promise<AdoptionInterest[]>;
  updateStatus(id: string, status: InterestStage): Promise<void>;
}
