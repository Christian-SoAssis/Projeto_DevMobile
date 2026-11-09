import { AdoptionInterest } from '../../domain/entities/AdoptionInterest';
import { InterestStatus } from '../../domain/value-objects/InterestStatus';
import { AdoptionInterestRepository } from '../../domain/ports/AdoptionInterestRepository';

export class AdoptionInterestRepositoryFake implements AdoptionInterestRepository {
  public interests: AdoptionInterest[] = [];

  async registerInterest(interest: AdoptionInterest): Promise<void> {
    const exists = await this.hasInterest(interest.userId, interest.animalId);
    if (!exists) {
      this.interests.push(interest);
    }
  }

  async listByUser(userId: string): Promise<AdoptionInterest[]> {
    return this.interests.filter((i) => i.userId === userId);
  }

  async listByAnimal(animalId: string): Promise<AdoptionInterest[]> {
    return this.interests.filter((i) => i.animalId === animalId);
  }

  async hasInterest(userId: string, animalId: string): Promise<boolean> {
    return this.interests.some((i) => i.userId === userId && i.animalId === animalId);
  }

  async updateStatus(interestId: string, status: InterestStatus, updatedAt: string): Promise<void> {
    const index = this.interests.findIndex((i) => i.id === interestId);
    if (index === -1) return; // linha só no servidor: no-op (a intenção viaja na fila).
    this.interests[index] = this.interests[index].withStatus(status, updatedAt);
  }
}
