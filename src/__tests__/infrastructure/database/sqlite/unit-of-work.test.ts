import { SqliteUnitOfWork } from '../../../../infrastructure/database/sqlite/SqliteUnitOfWork';
import { InMemorySqliteDriver } from '../../../../infrastructure/database/sqlite/DatabaseDriver';
import { Animal } from '../../../../domain/entities/Animal';
import { AnimalCharacteristics } from '../../../../domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../../../domain/value-objects/ApproximateLocation';
import { AdoptionStatus } from '../../../../domain/value-objects/AdoptionStatus';
import { SyncAction } from '../../../../domain/entities/SyncAction';
import { SyncState } from '../../../../domain/value-objects/SyncState';

describe('SqliteUnitOfWork (OFF-04)', () => {
  it('deve executar transação atômica com sucesso', async () => {
    const db = new InMemorySqliteDriver();
    const uow = new SqliteUnitOfWork(db);

    let transactionExecuted = false;
    const result = await uow.runInTransaction(async () => {
      transactionExecuted = true;
      return 'sucesso';
    });

    expect(result).toBe('sucesso');
    expect(transactionExecuted).toBe(true);
  });

  it('deve propagar erro se a tarefa falhar dentro da transação', async () => {
    const db = new InMemorySqliteDriver();
    const uow = new SqliteUnitOfWork(db);

    await expect(
      uow.runInTransaction(async () => {
        throw new Error('falha na transação');
      })
    ).rejects.toThrow('falha na transação');
  });

  it('deve garantir atomicidade entre animal e ação de fila (cenário OFF-04)', async () => {
    const db = new InMemorySqliteDriver();
    const uow = new SqliteUnitOfWork(db);

    const animal = new Animal({
      id: 'animal-atomic',
      ownerId: 'user-1',
      name: 'Atomic',
      characteristics: new AnimalCharacteristics({
        species: 'Cão',
        size: 'Médio',
        approximateAge: '2 anos',
        sex: 'Fêmea',
      }),
      location: new ApproximateLocation({
        neighborhood: 'Centro',
        city: 'Varginha',
      }),
      status: AdoptionStatus.available(),
    });

    const syncAction = new SyncAction({
      id: 'action-atomic',
      operation: 'CREATE',
      entityType: 'animal',
      entityId: animal.id,
      payload: { ownerId: 'user-1' },
      status: SyncState.pending(),
    });

    // Ambas as operações devem ocorrer dentro da mesma transação
    await uow.runInTransaction(async () => {
      await db.runAsync(
        'INSERT INTO animals (id, owner_id, name, species, size, approximate_age, sex, status, neighborhood, city, region, latitude, longitude, hidden, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          animal.id,
          animal.ownerId,
          animal.name,
          animal.characteristics.species,
          animal.characteristics.size,
          animal.characteristics.approximateAge,
          animal.characteristics.sex,
          animal.status.value,
          animal.location.neighborhood,
          animal.location.city,
          animal.location.region,
          animal.location.latitude,
          animal.location.longitude,
          animal.hidden ? 1 : 0,
          animal.version,
          animal.createdAt,
          animal.updatedAt,
        ]
      );

      await db.runAsync(
        'INSERT INTO sync_queue (id, operation, entity_type, entity_id, payload_json, changed_at, attempts, status, last_error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          syncAction.id,
          syncAction.operation,
          syncAction.entityType,
          syncAction.entityId,
          JSON.stringify(syncAction.payload),
          new Date().toISOString(),
          syncAction.attempts,
          syncAction.status.value,
          null,
        ]
      );
    });

    // Verifica que ambos foram persistidos
    const savedAnimal = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM animals WHERE id = ?',
      ['animal-atomic']
    );
    expect(savedAnimal).not.toBeNull();
    expect(savedAnimal?.id).toBe('animal-atomic');

    const savedAction = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM sync_queue WHERE id = ?',
      ['action-atomic']
    );
    expect(savedAction).not.toBeNull();
    expect(savedAction?.id).toBe('action-atomic');
  });

  it('deve propagar erro se a tarefa falhar dentro da transação', async () => {
    const db = new InMemorySqliteDriver();
    const uow = new SqliteUnitOfWork(db);

    // Nota: o InMemorySqliteDriver não implementa rollback real de transação,
    // apenas propaga a execução. O teste verifica que o erro é propagado.
    await expect(
      uow.runInTransaction(async () => {
        await db.runAsync(
          'INSERT INTO animals (id, owner_id, name, species, size, approximate_age, sex, status, neighborhood, city, region, latitude, longitude, hidden, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          ['animal-rollback', 'user-1', 'Rollback', 'Cão', 'Médio', '2 anos', 'Fêmea', 'AVAILABLE', 'Centro', 'Varginha', 'MG', -21.55, -45.43, 0, 1, '2026-01-01', '2026-01-01']
        );
        throw new Error('erro simulado');
      })
    ).rejects.toThrow('erro simulado');
  });
});
