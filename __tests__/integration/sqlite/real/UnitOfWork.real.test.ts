/**
 * @jest-environment node
 */
import { BetterSqliteDriver } from '../../../../test-support/BetterSqliteDriver';
import { applyMigrations } from '../../../../src/infrastructure/database/sqlite/migrations';
import { SqliteUnitOfWork } from '../../../../src/infrastructure/database/sqlite/SqliteUnitOfWork';
import { SqliteAnimalRepository } from '../../../../src/infrastructure/database/sqlite/repositories/SqliteAnimalRepository';
import { SqliteSyncQueueRepository } from '../../../../src/infrastructure/database/sqlite/repositories/SqliteSyncQueueRepository';
import { SyncAction } from '../../../../src/domain/entities/SyncAction';
import { makeAnimal, makePhoto } from '../../../../test-support/fixtures';

describe('SqliteUnitOfWork sobre SQLite real', () => {
  let driver: BetterSqliteDriver;
  let animalRepository: SqliteAnimalRepository;
  let queueRepository: SqliteSyncQueueRepository;
  let unitOfWork: SqliteUnitOfWork;

  beforeEach(async () => {
    driver = new BetterSqliteDriver();
    await applyMigrations(driver);
    animalRepository = new SqliteAnimalRepository(driver);
    queueRepository = new SqliteSyncQueueRepository(driver);
    unitOfWork = new SqliteUnitOfWork(driver);
  });

  afterEach(() => {
    driver.close();
  });

  const makeAction = () =>
    new SyncAction({
      id: 'sync_create_animal_1',
      operation: 'CREATE',
      entityType: 'animal',
      entityId: 'animal_1',
      payload: { name: 'Luna' },
    });

  it('confirma anúncio + ação da fila juntos quando o trabalho conclui', async () => {
    await unitOfWork.run(async () => {
      await animalRepository.saveLocal(makeAnimal({ photos: [makePhoto()] }));
      await queueRepository.enqueue(makeAction());
    });

    expect(await animalRepository.findById('animal_1')).not.toBeNull();
    expect(await queueRepository.findById('sync_create_animal_1')).not.toBeNull();
  });

  it('faz rollback do anúncio, fotos e fila quando o trabalho lança erro', async () => {
    await expect(
      unitOfWork.run(async () => {
        await animalRepository.saveLocal(makeAnimal({ photos: [makePhoto()] }));
        await queueRepository.enqueue(makeAction());
        throw new Error('falha no meio da mutação');
      })
    ).rejects.toThrow('falha no meio da mutação');

    expect(await animalRepository.findById('animal_1')).toBeNull();
    expect(await queueRepository.findById('sync_create_animal_1')).toBeNull();
    expect(await driver.getAllAsync(`SELECT * FROM animal_photos`)).toHaveLength(0);
  });

  it('participa de transação aninhada sem abrir BEGIN dentro de BEGIN', async () => {
    // saveLocal abre sua própria transação; dentro do UnitOfWork ela deve
    // apenas participar da transação externa.
    await unitOfWork.run(async () => {
      await animalRepository.saveLocal(makeAnimal());
    });
    expect(await animalRepository.findById('animal_1')).not.toBeNull();

    await expect(
      unitOfWork.run(async () => {
        await animalRepository.saveLocal(makeAnimal({ id: 'animal_2' }));
        throw new Error('rollback externo');
      })
    ).rejects.toThrow('rollback externo');
    expect(await animalRepository.findById('animal_2')).toBeNull();
  });
});
