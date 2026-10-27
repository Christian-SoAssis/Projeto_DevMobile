import { InMemorySqliteDriver } from '../../../src/infrastructure/database/sqlite/DatabaseDriver';
import { INITIAL_SCHEMA_SQL } from '../../../src/infrastructure/database/sqlite/migrations/schema.sql';
import { loadAppContainer } from '../../../src/infrastructure/composition/loadAppContainer';
import { Animal } from '../../../src/domain/entities/Animal';
import { AnimalPhoto } from '../../../src/domain/entities/AnimalPhoto';
import { AnimalCharacteristics } from '../../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../../src/domain/value-objects/ApproximateLocation';
import { Favorite } from '../../../src/domain/entities/Favorite';
import { AdoptionInterest } from '../../../src/domain/entities/AdoptionInterest';
import { SqliteFavoriteRepository } from '../../../src/infrastructure/database/sqlite/repositories/SqliteFavoriteRepository';

describe('loadAppContainer — composição da Fase 2 (cache online/offline no SQLite)', () => {
  const makeUserAnimal = (id: string) =>
    new Animal({
      id,
      ownerId: 'usr_1',
      name: 'Rex',
      characteristics: new AnimalCharacteristics({
        species: 'Cão',
        size: 'Pequeno',
        approximateAge: '1 ano',
        sex: 'Macho',
      }),
      location: new ApproximateLocation({
        latitude: 0,
        longitude: 0,
        neighborhood: 'Centro',
        city: 'Varginha',
        region: 'MG',
      }),
    });

  it('comporta os repositórios SQLite e popula o cache na primeira execução', async () => {
    const db = new InMemorySqliteDriver();
    await db.execAsync(INITIAL_SCHEMA_SQL);

    const container = await loadAppContainer(db);

    expect(container.mode).toBe('sqlite');

    const seeded = await container.animalRepository.search({});
    expect(seeded.length).toBe(7);
    expect(seeded.map((a) => a.id)).toEqual(
      expect.arrayContaining(['anim_1', 'anim_2', 'anim_7'])
    );

    // Geolocalização do seed integrada ao banco (item "geolocalização + SQLite").
    const anim1 = await container.animalRepository.findById('anim_1');
    expect(anim1).not.toBeNull();
    expect(anim1!.location.city).toBe('Varginha');
    expect(anim1!.location.neighborhood).toBe('Centro');
    expect(anim1!.location.latitude).toBeCloseTo(-21.554);

    // Foto registrada com o endereço remoto no cache local.
    expect(anim1!.photos).toHaveLength(1);
    expect(anim1!.photos[0].displayUrl).toContain('unsplash');
  });

  it('não repopula o seed em execução seguinte — dados do usuário sobrevivem ao reinício (RNF01/RNF02)', async () => {
    const db = new InMemorySqliteDriver();
    await db.execAsync(INITIAL_SCHEMA_SQL);

    const primeiraExecucao = await loadAppContainer(db);
    await primeiraExecucao.animalRepository.saveLocal(makeUserAnimal('anim_user_1'));

    // "Reinício": mesmo banco, nova composição de container.
    const segundaExecucao = await loadAppContainer(db);

    const userAnimal = await segundaExecucao.animalRepository.findById('anim_user_1');
    expect(userAnimal).not.toBeNull();
    expect(userAnimal!.name).toBe('Rex');

    const total = await segundaExecucao.animalRepository.search({});
    expect(total).toHaveLength(8); // 7 do seed + 1 do usuário (sem duplicar seed)
  });

  it('favoritos e interesses persistem no SQLite via container', async () => {
    const db = new InMemorySqliteDriver();
    await db.execAsync(INITIAL_SCHEMA_SQL);

    const container = await loadAppContainer(db);

    await container.favoriteRepository.addFavorite(new Favorite('usr_2', 'anim_1'));
    await container.interestRepository.registerInterest(
      new AdoptionInterest('int_1', 'usr_2', 'anim_1')
    );

    expect(await container.favoriteRepository.isFavorite('usr_2', 'anim_1')).toBe(true);
    expect(await container.favoriteRepository.listByUser('usr_2')).toHaveLength(1);

    expect(await container.interestRepository.hasInterest('usr_2', 'anim_1')).toBe(true);
    expect(await container.interestRepository.listByUser('usr_2')).toHaveLength(1);
    expect(await container.interestRepository.listByAnimal('anim_1')).toHaveLength(1);

    // Persistência real: nova instância sobre o mesmo banco enxerga os dados.
    const mesmoBancoNovaInstancia = new SqliteFavoriteRepository(db);
    expect(await mesmoBancoNovaInstancia.isFavorite('usr_2', 'anim_1')).toBe(true);

    // Foto local da imagem acessada no app registrada no SQLite (local_images).
    const photo = new AnimalPhoto({
      id: 'p1',
      animalId: 'anim_1',
      localPath: 'file://p1.jpg',
    });
    await container.photoStorage.persistLocal(photo);
    const pending = await container.photoStorage.listPendingUpload();
    expect(pending).toHaveLength(1);
    expect(pending[0].animalId).toBe('anim_1');
  });
});
