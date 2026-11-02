import { ModerateAnimalUseCase } from '../../src/application/use-cases/ModerateAnimalUseCase';
import { ModerationGateway, ModerationAction } from '../../src/domain/ports/ModerationGateway';
import { User } from '../../src/domain/entities/User';
import { ContactInfo } from '../../src/domain/value-objects/ContactInfo';

function makeUser(id: string, role: User['role']): User {
  return new User({ id, name: 'Fulano', contactInfo: new ContactInfo('fulano@test.com'), role });
}

function makeGateway(): ModerationGateway & { calls: Array<{ animalId: string; action: ModerationAction }> } {
  const calls: Array<{ animalId: string; action: ModerationAction }> = [];
  return {
    calls,
    listForModeration: async () => [],
    moderateAnimal: async (animalId: string, action: ModerationAction) => {
      calls.push({ animalId, action });
    },
  };
}

/**
 * Doc §16.2: `ModerateAnimalUseCase_rejects_non_admin` (UC20).
 * A UI/roles do cliente nunca decidem moderação — admin no domínio + RLS.
 */
describe('ModerateAnimalUseCase (UC20 — moderação só ADMIN)', () => {
  it('deve rejeitar usuário não-admin (USER) sem tocar o gateway', async () => {
    const gateway = makeGateway();
    const useCase = new ModerateAnimalUseCase(gateway);

    await expect(
      useCase.execute(makeUser('usr_2', 'USER'), 'anim_1', 'HIDE')
    ).rejects.toThrow('Somente administradores podem moderar anúncios (UC20).');

    expect(gateway.calls).toHaveLength(0);
  });

  it('deve rejeitar usuário não-admin (RESPONSIBLE e VISITOR)', async () => {
    const gateway = makeGateway();
    const useCase = new ModerateAnimalUseCase(gateway);

    for (const role of ['RESPONSIBLE', 'VISITOR', 'INTERESTED'] as User['role'][]) {
      await expect(useCase.execute(makeUser('usr_3', role), 'anim_1', 'HIDE')).rejects.toThrow();
    }
    expect(gateway.calls).toHaveLength(0);
  });

  it('deve rejeitar ator ausente (não autenticado)', async () => {
    const gateway = makeGateway();
    const useCase = new ModerateAnimalUseCase(gateway);

    await expect(useCase.execute(null, 'anim_1', 'HIDE')).rejects.toThrow('Usuário não autenticado.');
    expect(gateway.calls).toHaveLength(0);
  });

  it('deve rejeitar animalId ausente', async () => {
    const gateway = makeGateway();
    const useCase = new ModerateAnimalUseCase(gateway);

    await expect(useCase.execute(makeUser('adm_1', 'ADMIN'), '', 'HIDE')).rejects.toThrow(
      'ID do animal é obrigatório.'
    );
    expect(gateway.calls).toHaveLength(0);
  });

  it(' usuário ADMIN delega a ação ao gateway (a RLS é a segunda barreira)', async () => {
    const gateway = makeGateway();
    const useCase = new ModerateAnimalUseCase(gateway);

    await useCase.execute(makeUser('adm_1', 'ADMIN'), 'anim_1', 'HIDE');

    expect(gateway.calls).toEqual([{ animalId: 'anim_1', action: 'HIDE' }]);
  });

  it('ação UNHIDE também passa pelo mesmo caminho admin-only', async () => {
    const gateway = makeGateway();
    const useCase = new ModerateAnimalUseCase(gateway);

    await useCase.execute(makeUser('adm_1', 'ADMIN'), 'anim_2', 'UNHIDE');

    expect(gateway.calls).toEqual([{ animalId: 'anim_2', action: 'UNHIDE' }]);
  });
});
