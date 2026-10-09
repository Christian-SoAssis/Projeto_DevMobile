import { Animal } from '../../../src/domain/entities/Animal';
import { AnimalCharacteristics } from '../../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../../src/domain/value-objects/ApproximateLocation';
import { AdoptionStatus } from '../../../src/domain/value-objects/AdoptionStatus';
import { InMemorySqliteDriver } from '../../../src/infrastructure/database/sqlite/DatabaseDriver';
import { INITIAL_SCHEMA_SQL } from '../../../src/infrastructure/database/sqlite/migrations/schema.sql';
import { SqliteAnimalRepository } from '../../../src/infrastructure/database/sqlite/repositories/SqliteAnimalRepository';

describe('SqliteAnimalRepository', () => {
  let db: InMemorySqliteDriver;
  let repository: SqliteAnimalRepository;

  beforeEach(async () => {
    db = new InMemorySqliteDriver();
    await db.execAsync(INITIAL_SCHEMA_SQL);
    repository = new SqliteAnimalRepository(db);
  });

  const createSampleAnimal = (id = 'animal_1', ownerId = 'user_1', name = 'Thor') =>
    new Animal({
      id,
      ownerId,
      name,
      characteristics: new AnimalCharacteristics({
        species: 'Cão',
        size: 'Grande',
        approximateAge: '2 anos',
        sex: 'Macho',
      }),
      status: AdoptionStatus.available(),
      location: new ApproximateLocation({
        neighborhood: 'Centro',
        city: 'Varginha',
        region: 'Sul de Minas',
        latitude: -21.55,
        longitude: -45.43,
      }),
    });

  it('salva localmente um animal e o recupera por ID', async () => {
    const animal = createSampleAnimal();
    await repository.saveLocal(animal);

    const found = await repository.findById('animal_1');
    expect(found).not.toBeNull();
    expect(found?.id).toBe('animal_1');
    expect(found?.name).toBe('Thor');
    expect(found?.characteristics.species).toBe('Cão');
    expect(found?.location.city).toBe('Varginha');
  });

  it('filtra animais por espécie, porte e sexo', async () => {
    const a1 = createSampleAnimal('a1', 'u1', 'Rex');
    const a2 = new Animal({
      id: 'a2',
      ownerId: 'u2',
      name: 'Mimi',
      characteristics: new AnimalCharacteristics({
        species: 'Gato',
        size: 'Pequeno',
        approximateAge: '1 ano',
        sex: 'Fêmea',
      }),
      status: AdoptionStatus.available(),
      location: new ApproximateLocation({
        neighborhood: 'Vila',
        city: 'Varginha',
        region: 'Sul de Minas',
        latitude: -21.55,
        longitude: -45.43,
      }),
    });

    await repository.saveLocal(a1);
    await repository.saveLocal(a2);

    const cats = await repository.search({ species: 'Gato' });
    expect(cats).toHaveLength(1);
    expect(cats[0].name).toBe('Mimi');

    const dogs = await repository.search({ species: 'Cão' });
    expect(dogs).toHaveLength(1);
    expect(dogs[0].name).toBe('Rex');
  });

  it('lista animais de um proprietário específico', async () => {
    const a1 = createSampleAnimal('a1', 'owner_A', 'Bob');
    const a2 = createSampleAnimal('a2', 'owner_A', 'Max');
    const a3 = createSampleAnimal('a3', 'owner_B', 'Luna');

    await repository.saveLocal(a1);
    await repository.saveLocal(a2);
    await repository.saveLocal(a3);

    const ownerAAnimals = await repository.listByOwner('owner_A');
    expect(ownerAAnimals).toHaveLength(2);
    expect(ownerAAnimals.map((a) => a.name)).toEqual(['Bob', 'Max']);
  });

  it('atualiza os dados de um animal e remove quando solicitado', async () => {
    const animal = createSampleAnimal('a1', 'owner_1', 'Pipoca');
    await repository.saveLocal(animal);

    animal.markAdopted('owner_1');
    await repository.updateRemote(animal);

    const updated = await repository.findById('a1');
    expect(updated?.status.isAdopted()).toBe(true);

    await repository.deleteRemote('a1');
    const deleted = await repository.findById('a1');
    expect(deleted).toBeNull();
  });

  it('persiste dados no cache em reinício (nova instância do repositório)', async () => {
    const animal = createSampleAnimal('cache_1', 'owner_1', 'Bidu');
    await repository.saveLocal(animal);

    // Reinstancia repositório com a mesma instância de banco
    const newRepoInstance = new SqliteAnimalRepository(db);
    const cached = await newRepoInstance.findById('cache_1');
    expect(cached).not.toBeNull();
    expect(cached?.name).toBe('Bidu');
  });
});
