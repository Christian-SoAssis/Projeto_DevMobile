import { Animal } from '../../src/domain/entities/Animal';
import { AnimalCharacteristics } from '../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../src/domain/value-objects/ApproximateLocation';
import { ContactInfo } from '../../src/domain/value-objects/ContactInfo';
import { User } from '../../src/domain/entities/User';
import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { FavoriteRepositoryFake } from '../../src/application/fakes/FavoriteRepositoryFake';
import { AdoptionInterestRepositoryFake } from '../../src/application/fakes/AdoptionInterestRepositoryFake';
import { SyncQueueRepositoryFake } from '../../src/application/fakes/SyncQueueRepositoryFake';
import { AuthGatewayFake } from '../../src/application/fakes/AuthGatewayFake';
import { SessionStorageFake } from '../../src/application/fakes/SessionStorageFake';
import { AuthenticateUserUseCase } from '../../src/application/use-cases/AuthenticateUserUseCase';
import { ToggleFavoriteUseCase } from '../../src/application/use-cases/ToggleFavoriteUseCase';
import { CreateAnimalUseCase } from '../../src/application/use-cases/CreateAnimalUseCase';
import { UpdateAnimalUseCase } from '../../src/application/use-cases/UpdateAnimalUseCase';
import { DeleteAnimalUseCase } from '../../src/application/use-cases/DeleteAnimalUseCase';
import { MarkAnimalAdoptedUseCase } from '../../src/application/use-cases/MarkAnimalAdoptedUseCase';
import { RegisterAdoptionInterestUseCase } from '../../src/application/use-cases/RegisterAdoptionInterestUseCase';

function makeAnimal(id: string, ownerId: string, name = 'Luna') {
  return new Animal({
    id,
    ownerId,
    name,
    characteristics: new AnimalCharacteristics({
      species: 'Cão',
      size: 'Médio',
      approximateAge: '2 anos',
      sex: 'Fêmea',
    }),
    location: new ApproximateLocation({
      latitude: -21.55,
      longitude: -45.43,
      neighborhood: 'Centro',
      city: 'Varginha',
      region: 'MG',
    }),
  });
}

describe('E2E mock — fluxos práticos (doc §16.4 itens 2, 3, 7, 8)', () => {
  it('item 2: usuário autentica (mock) e favorita um anúncio', async () => {
    const auth = new AuthGatewayFake();
    const storage = new SessionStorageFake();
    const session = await new AuthenticateUserUseCase(auth, storage).execute('carlos@exemplo.com', 'x');
    expect(session.user.id).toBe('usr_2');
    expect(await storage.getSessionToken()).toBe('fake_token_usr_2');

    const animals = new AnimalRepositoryFake([makeAnimal('a1', 'usr_1')]);
    const favorites = new FavoriteRepositoryFake();
    const state = await new ToggleFavoriteUseCase(favorites).execute(session.user.id, 'a1');
    expect(state).toBe(true);
    expect(await favorites.isFavorite(session.user.id, 'a1')).toBe(true);
    expect(animals).toBeTruthy();
  });

  it('item 3: responsável cria anúncio online (mock)', async () => {
    const animals = new AnimalRepositoryFake();
    const queue = new SyncQueueRepositoryFake();
    const { animal, synced } = await new CreateAnimalUseCase(animals, queue).execute(
      makeAnimal('a9', 'usr_1', 'Thor'),
      true
    );
    expect(synced).toBe(true);
    expect((await animals.findById('a9'))?.name).toBe('Thor');
    expect(animal.name).toBe('Thor');
    expect(await queue.listPending()).toHaveLength(0);
  });

  it('item 7: responsável marca animal como adotado (mock)', async () => {
    const animals = new AnimalRepositoryFake([makeAnimal('a1', 'usr_1')]);
    const queue = new SyncQueueRepositoryFake();
    const interests = new AdoptionInterestRepositoryFake();
    await new RegisterAdoptionInterestUseCase(interests).execute('usr_2', 'a1');
    const updated = await new MarkAnimalAdoptedUseCase(animals, queue).execute('usr_1', 'a1', true);
    expect(updated.status.isAdopted()).toBe(true);
  });

  it('item 8: terceiro não edita nem exclui anúncio de outro (mock)', async () => {
    const animals = new AnimalRepositoryFake([makeAnimal('a1', 'usr_1')]);
    const queue = new SyncQueueRepositoryFake();
    await expect(
      new UpdateAnimalUseCase(animals, queue).execute('usr_2', 'a1', { name: 'Invasão' }, true)
    ).rejects.toThrow('Somente o responsável pelo anúncio pode alterar seus dados.');
    await expect(new DeleteAnimalUseCase(animals, queue).execute('usr_2', 'a1', true)).rejects.toThrow(
      'Somente o responsável pelo anúncio pode excluí-lo.'
    );
    expect((await animals.findById('a1'))?.name).toBe('Luna');
  });

  it('interesse: contato do responsável permanece acessível via User (mock)', async () => {
    const owner = new User({
      id: 'usr_1',
      name: 'Ana Silva',
      contactInfo: new ContactInfo('ana@exemplo.com', '11999998888'),
      role: 'RESPONSIBLE',
    });
    expect(owner.contactInfo.email).toBe('ana@exemplo.com');
  });
});
