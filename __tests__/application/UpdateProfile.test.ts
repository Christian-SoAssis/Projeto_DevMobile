import { User } from '../../src/domain/entities/User';
import { ContactInfo } from '../../src/domain/value-objects/ContactInfo';
import { MAX_BIO_LENGTH, normalizeInterests } from '../../src/domain/value-objects/UserProfile';
import { UpdateProfileUseCase } from '../../src/application/use-cases/UpdateProfileUseCase';
import { AuthGatewayFake } from '../../src/application/fakes/AuthGatewayFake';
import { UserRepositoryFake } from '../../src/application/fakes/UserRepositoryFake';
import { PhotoStorageFake } from '../../src/application/fakes/PhotoStorageFake';

const base = () =>
  new User({ id: 'u1', name: 'Ana', contactInfo: new ContactInfo('ana@x.com', '11999'), role: 'USER' });

describe('User.withProfile / UserProfile', () => {
  it('altera só o perfil e preserva identidade (id, e-mail, papel)', () => {
    const u = base().withProfile({
      name: ' Ana Maria ',
      phone: ' 11888 ',
      bio: ' amo gatos ',
      interests: ['Gatos', 'Inexistente', 'Gatos', 'Cães'],
    });
    expect(u.id).toBe('u1');
    expect(u.role).toBe('USER');
    expect(u.contactInfo.email).toBe('ana@x.com');
    expect(u.name).toBe('Ana Maria');
    expect(u.contactInfo.phone).toBe('11888');
    expect(u.bio).toBe('amo gatos');
    expect(u.interests).toEqual(['Cães', 'Gatos']);
  });

  it('telefone vazio remove; avatar null remove; undefined mantém', () => {
    const withAvatar = base().withProfile({ avatarUri: 'file://a.jpg' });
    expect(withAvatar.avatarUri).toBe('file://a.jpg');
    expect(withAvatar.withProfile({ name: 'Novo' }).avatarUri).toBe('file://a.jpg');
    expect(withAvatar.withProfile({ avatarUri: null }).avatarUri).toBeUndefined();
    expect(base().withProfile({ phone: '  ' }).contactInfo.phone).toBeUndefined();
  });

  it('rejeita nome vazio e descrição acima do limite', () => {
    expect(() => base().withProfile({ name: '  ' })).toThrow('Nome do usuário é obrigatório.');
    expect(() => base().withProfile({ bio: 'x'.repeat(MAX_BIO_LENGTH + 1) })).toThrow(
      `no máximo ${MAX_BIO_LENGTH} caracteres`
    );
  });

  it('normalizeInterests tolera nulos', () => {
    expect(normalizeInterests(undefined)).toEqual([]);
    expect(normalizeInterests(null)).toEqual([]);
  });
});

describe('UpdateProfileUseCase', () => {
  function setup() {
    const gateway = new AuthGatewayFake();
    const repo = new UserRepositoryFake();
    const storage = new PhotoStorageFake();
    return { gateway, repo, storage, useCase: new UpdateProfileUseCase(gateway, repo, storage) };
  }

  it('grava localmente e no servidor', async () => {
    const { gateway, repo, useCase } = setup();
    const res = await useCase.execute(gateway.mockUsers[0], { bio: 'oi', interests: ['Cães'] });
    expect(res.syncedRemotely).toBe(true);
    expect((await repo.findById('usr_1'))?.bio).toBe('oi');
    expect(gateway.mockUsers[0].interests).toEqual(['Cães']);
  });

  it('servidor indisponível → mantém a edição local e avisa (sem perda silenciosa)', async () => {
    const { gateway, repo, useCase } = setup();
    gateway.updateProfile = jest.fn().mockRejectedValue(new Error('network'));
    const res = await useCase.execute(gateway.mockUsers[0], { bio: 'offline' });
    expect(res.syncedRemotely).toBe(false);
    expect(res.user.bio).toBe('offline');
    expect((await repo.findById('usr_1'))?.bio).toBe('offline');
  });

  it('dados inválidos não gravam nada', async () => {
    const { gateway, repo, useCase } = setup();
    await expect(useCase.execute(gateway.mockUsers[0], { name: '' })).rejects.toThrow();
    expect(await repo.findById('usr_1')).toBeNull();
  });

  it('foto: persiste pelo PhotoStorage e usa o destino definitivo; remover limpa', async () => {
    const { gateway, useCase, storage } = setup();
    const spy = jest.spyOn(storage, 'persistLocal');
    const first = await useCase.execute(gateway.mockUsers[0], { avatarUri: 'file://tmp/cam.jpg' });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(first.user.avatarUri).toBeDefined();

    // Mesmo URI de novo: nada a persistir.
    await useCase.execute(first.user, { avatarUri: first.user.avatarUri });
    expect(spy).toHaveBeenCalledTimes(1);

    const removed = await useCase.execute(first.user, { avatarUri: null });
    expect(removed.user.avatarUri).toBeUndefined();
  });

  it('sem PhotoStorage guarda a URI como veio', async () => {
    const gateway = new AuthGatewayFake();
    const useCase = new UpdateProfileUseCase(gateway, new UserRepositoryFake());
    const res = await useCase.execute(gateway.mockUsers[0], { avatarUri: 'file://x.jpg' });
    expect(res.user.avatarUri).toBe('file://x.jpg');
  });
});
