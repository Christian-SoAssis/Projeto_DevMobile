import { AnimalPhoto } from '../../src/domain/entities/AnimalPhoto';
import { User } from '../../src/domain/entities/User';
import { ContactInfo } from '../../src/domain/value-objects/ContactInfo';
import { UpdateAnimalUseCase } from '../../src/application/use-cases/UpdateAnimalUseCase';
import { UpdateProfileUseCase } from '../../src/application/use-cases/UpdateProfileUseCase';
import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { SyncQueueRepositoryFake } from '../../src/application/fakes/SyncQueueRepositoryFake';
import { AuthGatewayFake } from '../../src/application/fakes/AuthGatewayFake';
import { UserRepositoryFake } from '../../src/application/fakes/UserRepositoryFake';
import { PhotoStorageFake } from '../../src/application/fakes/PhotoStorageFake';
import { makeAnimal, makePhoto } from '../../test-support/fixtures';

describe('Edição do anúncio com troca de foto', () => {
  it('a foto nova substitui a antiga, sobe a versão e entra na fila', async () => {
    const repo = new AnimalRepositoryFake([makeAnimal({ photos: [makePhoto({ id: 'old' })] })]);
    const queue = new SyncQueueRepositoryFake();
    const useCase = new UpdateAnimalUseCase(repo, queue);
    const next = new AnimalPhoto({ id: 'new', animalId: 'animal_1', localPath: 'file:///app/new.webp' });

    const updated = await useCase.execute('user_1', 'animal_1', { photo: next }, false);

    expect(updated.photos.map((p) => p.id)).toEqual(['new']);
    expect(updated.version).toBe(2);
    expect(await queue.listPending()).toHaveLength(1);
  });

  it('só o responsável troca a foto; foto de outro animal é recusada', () => {
    const animal = makeAnimal();
    const photo = new AnimalPhoto({ id: 'p', animalId: 'animal_1', localPath: 'file:///p.webp' });
    expect(() => animal.replacePhotos('outro', photo)).toThrow('Somente o responsável pode alterar as fotos.');
    const alheia = new AnimalPhoto({ id: 'q', animalId: 'animal_9', localPath: 'file:///q.webp' });
    expect(() => animal.replacePhotos('user_1', alheia)).toThrow('Foto não pertence a este animal.');
  });
});

describe('Foto de perfil no Storage (UpdateProfileUseCase)', () => {
  const base = () =>
    new User({ id: 'u1', name: 'Ana', contactInfo: new ContactInfo('ana@x.com'), role: 'USER' });

  function setup(remote?: PhotoStorageFake) {
    const gateway = new AuthGatewayFake();
    const local = new PhotoStorageFake();
    return {
      gateway,
      local,
      useCase: new UpdateProfileUseCase(gateway, new UserRepositoryFake(), local, remote),
    };
  }

  it('com backend: envia a foto e guarda a URL pública (visível em outro aparelho)', async () => {
    const remote = new PhotoStorageFake();
    const { useCase, gateway } = setup(remote);
    const spy = jest.spyOn(gateway, 'updateProfile');

    const { user } = await useCase.execute(base(), { avatarUri: 'file:///cache/a.webp' });

    expect(user.avatarUri).toBe('file:///cache/a.webp');
    expect(user.avatarUrl).toMatch(/^https:\/\/storage\.fake\/user:u1\//);
    expect(spy.mock.calls[0][0].avatarUrl).toBe(user.avatarUrl);
  });

  it('sem backend ou com upload falhando: perfil salva e a foto segue só local', async () => {
    const semBackend = setup();
    const a = await semBackend.useCase.execute(base(), { avatarUri: 'file:///cache/a.webp' });
    expect(a.user.avatarUrl).toBeUndefined();
    expect(a.user.avatarUri).toBeDefined();

    const remote = new PhotoStorageFake();
    jest.spyOn(remote, 'uploadPending').mockRejectedValue(new Error('rede'));
    const comFalha = setup(remote);
    const b = await comFalha.useCase.execute(base(), { avatarUri: 'file:///cache/b.webp' });
    expect(b.user.avatarUrl).toBeUndefined();
    expect(b.syncedRemotely).toBe(true);
  });

  it('próximo salvamento reenvia uma foto que ficou só local', async () => {
    const remote = new PhotoStorageFake();
    const { useCase } = setup(remote);
    const first = base().withProfile({ avatarUri: 'file:///cache/c.webp' }); // sem avatarUrl
    const { user } = await useCase.execute(first, { bio: 'oi' });
    expect(user.avatarUrl).toBeDefined();
  });

  it('remover a foto limpa a cópia local e a URL', async () => {
    const remote = new PhotoStorageFake();
    const { useCase } = setup(remote);
    const withPhoto = base().withProfile({ avatarUri: 'file:///cache/d.webp', avatarUrl: 'https://x/d.webp' });
    const { user } = await useCase.execute(withPhoto, { avatarUri: null });
    expect(user.avatarUri).toBeUndefined();
    expect(user.avatarUrl).toBeUndefined();
  });

  it('trocar a foto invalida a URL antiga e sobe a nova', async () => {
    const remote = new PhotoStorageFake();
    const { useCase } = setup(remote);
    const withPhoto = base().withProfile({ avatarUri: 'file:///cache/old.webp', avatarUrl: 'https://x/old.webp' });
    const { user } = await useCase.execute(withPhoto, { avatarUri: 'file:///cache/new.webp' });
    expect(user.avatarUrl).not.toBe('https://x/old.webp');
    expect(user.avatarUrl).toBeDefined();
  });
});
