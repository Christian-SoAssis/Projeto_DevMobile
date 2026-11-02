import { ModerationAction, ModerationEntry, ModerationGateway } from '../../domain/ports/ModerationGateway';
import { User } from '../../domain/entities/User';

/**
 * Moderação de anúncios (UC20, RF27; doc §16.2 `ModerateAnimalUseCase_rejects_non_admin`).
 *
 * Defesa em profundidade (doc §15.3): **a UI nunca é barreira de segurança** —
 * 1. este use case rejeita quem não for ADMIN;
 * 2. o adapter remoto envia apenas `moderation_status`;
 * 3. a RLS do Postgres rejeita `UPDATE` de quem não é admin (§15.1).
 */
export class ModerateAnimalUseCase {
  constructor(private moderationGateway: ModerationGateway) {}

  async list(actor: User | null): Promise<ModerationEntry[]> {
    if (!actor) {
      throw new Error('Usuário não autenticado.');
    }
    if (!actor.isAdmin()) {
      throw new Error('Somente administradores podem moderar anúncios (UC20).');
    }
    return this.moderationGateway.listForModeration();
  }

  async execute(actor: User | null, animalId: string, action: ModerationAction): Promise<void> {
    if (!actor) {
      throw new Error('Usuário não autenticado.');
    }
    if (!actor.isAdmin()) {
      throw new Error('Somente administradores podem moderar anúncios (UC20).');
    }
    if (!animalId) {
      throw new Error('ID do animal é obrigatório.');
    }
    await this.moderationGateway.moderateAnimal(animalId, action);
  }
}
