import { AdoptionInterest, InterestStage } from '../entities/AdoptionInterest';

export interface InterestRemoteGateway {
  upsert(interest: AdoptionInterest): Promise<void>;
  updateStatus(id: string, status: InterestStage): Promise<void>;
  listByUser(userId: string): Promise<AdoptionInterest[]>;
  listByAnimal(animalId: string): Promise<AdoptionInterest[]>;
}
