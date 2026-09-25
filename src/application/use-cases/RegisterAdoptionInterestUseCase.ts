import { AdoptionInterest } from '../../domain/entities/AdoptionInterest';
import { AdoptionInterestRepository } from '../../domain/ports/AdoptionInterestRepository';

export class RegisterAdoptionInterestUseCase {
  constructor(private interestRepository: AdoptionInterestRepository) {}

  async execute(userId: string, animalId: string): Promise<AdoptionInterest> {
    if (!userId) throw new Error('Usuário deve estar autenticado para demonstrar interesse.');
    if (!animalId) throw new Error('ID do animal é obrigatório.');

    const interest = new AdoptionInterest(
      `interest_${userId}_${animalId}_${Date.now()}`,
      userId,
      animalId
    );
    await this.interestRepository.registerInterest(interest);
    return interest;
  }
}
