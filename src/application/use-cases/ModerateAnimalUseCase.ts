import { User } from '../../domain/entities/User';
import { AccessPolicy } from '../../domain/services/AccessPolicy';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { ModerationAction, ModerationGateway } from '../../domain/ports/ModerationGateway';

/**
 * Moderação administrativa (UC20, V15, RF27).
 */
export class ModerateAnimalUseCase {
  constructor(
    private animalRepository: AnimalRepository,
    private moderationGateway?: ModerationGateway
  ) {}

  async execute(
    actor: User | null,
    animalId: string,
    action: ModerationAction
  ): Promise<void> {
    if (!AccessPolicy.canModerate(actor)) {
      throw new Error('Apenas administradores podem moderar anúncios.');
    }

    const local = await this.animalRepository.findById(animalId);
    if (local) {
      local.setHidden(action === 'HIDE');
      await this.animalRepository.saveLocal(local);
    }

    if (this.moderationGateway) {
      await this.moderationGateway.moderateAnimal(animalId, action);
    }
  }
}
