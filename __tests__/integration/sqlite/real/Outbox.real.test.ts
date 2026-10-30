/**
 * @jest-environment node
 */
import { BetterSqliteDriver } from '../../../../test-support/BetterSqliteDriver';
import { applyMigrations } from '../../../../src/infrastructure/database/sqlite/migrations';
import { SqliteUnitOfWork } from '../../../../src/infrastructure/database/sqlite/SqliteUnitOfWork';
import { SqliteAnimalRepository } from '../../../../src/infrastructure/database/sqlite/repositories/SqliteAnimalRepository';
import { SqliteSyncQueueRepository } from '../../../../src/infrastructure/database/sqlite/repositories/SqliteSyncQueueRepository';
import { CreateAnimalUseCase } from '../../../../src/application/use-cases/CreateAnimalUseCase';
import { UpdateAnimalUseCase } from '../../../../src/application/use-cases/UpdateAnimalUseCase';
import { DeleteAnimalUseCase } from '../../../../src/application/use-cases/DeleteAnimalUseCase';
import { MarkAnimalAdoptedUseCase } from '../../../../src/application/use-cases/MarkAnimalAdoptedUseCase';
import { ProcessSyncQueueUseCase } from '../../../../src/application/use-cases/ProcessSyncQueueUseCase';
import { SyncAction } from '../../../../src/domain/entities/SyncAction';
import { makeAnimal } from '../../../../test-support/fixtures';

describe('Outbox local sobre SQLite real', () => {
  let driver: BetterSqliteDriver;
  let animals: SqliteAnimalRepository;
  let queue: SqliteSyncQueueRepository;
  let unitOfWork: SqliteUnitOfWork;

  beforeEach(async () => {
    driver = new BetterSqliteDriver();
    await applyMigrations(driver);
    animals = new SqliteAnimalRepository(driver);
    queue = new SqliteSyncQueueRepository(driver);
    unitOfWork = new SqliteUnitOfWork(driver);
  });

  afterEach(() => {
    driver.close();
  });

  it('criação offline grava anúncio + ação CREATE atomicamente', async () => {
    const useCase = new CreateAnimalUseCase(animals, queue, unitOfWork);
    const result = await useCase.execute(makeAnimal(), false);

    expect(result.synced).toBe(false);
    expect(await animals.findById('animal_1')).not.toBeNull();
    const pending = await queue.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].operation).toBe('CREATE');
    expect(pending[0].payload).toMatchObject({ name: 'Luna', city: 'Varginha' });
  });

  it('falha ao enfileirar desfaz a gravação local do anúncio', async () => {
    jest.spyOn(queue, 'enqueue').mockRejectedValue(new Error('fila indisponível'));
    const useCase = new CreateAnimalUseCase(animals, queue, unitOfWork);

    await expect(useCase.execute(makeAnimal(), false)).rejects.toThrow('fila indisponível');
    expect(await animals.findById('animal_1')).toBeNull();
    expect(await driver.getAllAsync('SELECT * FROM animal_photos')).toHaveLength(0);
  });

  it('criação online remove a ação da fila após sucesso remoto', async () => {
    const useCase = new CreateAnimalUseCase(animals, queue, unitOfWork);
    const result = await useCase.execute(makeAnimal(), true);

    expect(result.synced).toBe(true);
    expect(await animals.findById('animal_1')).not.toBeNull();
    expect(await queue.listPending()).toHaveLength(0);
  });

  it('edição offline persiste dados + fila e o processamento limpa a fila', async () => {
    await animals.saveLocal(makeAnimal());
    const update = new UpdateAnimalUseCase(animals, queue, unitOfWork);
    await update.execute('user_1', 'animal_1', { name: 'Luna Editada' }, false);

    const loaded = await animals.findById('animal_1');
    expect(loaded!.name).toBe('Luna Editada');
    expect((await queue.listPending()).map((a) => a.operation)).toEqual(['UPDATE']);

    const process = new ProcessSyncQueueUseCase(queue, animals);
    const result = await process.execute();
    expect(result.successCount).toBe(1);
    expect(await queue.listPending()).toHaveLength(0);
  });

  it('exclusão offline remove o anúncio local e processa DELETE com idempotência', async () => {
    await animals.saveLocal(makeAnimal());
    const remove = new DeleteAnimalUseCase(animals, queue, unitOfWork);
    await remove.execute('user_1', 'animal_1', false);

    expect(await animals.findById('animal_1')).toBeNull();
    expect((await queue.listPending()).map((a) => a.operation)).toEqual(['DELETE']);

    const process = new ProcessSyncQueueUseCase(queue, animals);
    const first = await process.execute();
    expect(first.successCount).toBe(1);
    expect(await queue.listPending()).toHaveLength(0);

    // Reprocessar sem ação pendente é um no-op.
    const second = await process.execute();
    expect(second.processedCount).toBe(0);
  });

  it('marcar adotado offline enfileira MARK_ADOPTED e sobrevive ao processamento', async () => {
    await animals.saveLocal(makeAnimal());
    const adopt = new MarkAnimalAdoptedUseCase(animals, queue, unitOfWork);
    await adopt.execute('user_1', 'animal_1', false);

    expect((await queue.listPending()).map((a) => a.operation)).toEqual(['MARK_ADOPTED']);
    const process = new ProcessSyncQueueUseCase(queue, animals);
    await process.execute();

    const loaded = await animals.findById('animal_1');
    expect(loaded!.status.isAdopted()).toBe(true);
    expect(await queue.listPending()).toHaveLength(0);
  });

  it('fila falha visivelmente para entidade não suportada e mantém a ação', async () => {
    await queue.enqueue(
      new SyncAction({
        id: 'sync_photo',
        operation: 'UPLOAD_PHOTO',
        entityType: 'photo',
        entityId: 'photo_1',
        payload: {},
      })
    );

    const process = new ProcessSyncQueueUseCase(queue, animals);
    const result = await process.execute();

    expect(result.failedCount).toBe(1);
    const action = await queue.findById('sync_photo');
    expect(action!.status.isFailed()).toBe(true);
    expect(action!.lastError).toContain('não está disponível na Fase 2');
  });
});
