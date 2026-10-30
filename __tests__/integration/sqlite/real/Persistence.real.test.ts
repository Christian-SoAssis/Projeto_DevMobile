/**
 * @jest-environment node
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { BetterSqliteDriver } from '../../../../test-support/BetterSqliteDriver';
import {
  applyMigrations,
  getSchemaVersion,
  LATEST_SCHEMA_VERSION,
} from '../../../../src/infrastructure/database/sqlite/migrations';
import { SqliteAnimalRepository } from '../../../../src/infrastructure/database/sqlite/repositories/SqliteAnimalRepository';
import { SqliteSyncQueueRepository } from '../../../../src/infrastructure/database/sqlite/repositories/SqliteSyncQueueRepository';
import { loadAppContainer } from '../../../../src/infrastructure/composition/loadAppContainer';
import { SyncAction } from '../../../../src/domain/entities/SyncAction';
import { makeAnimal } from '../../../../test-support/fixtures';

describe('Persistência em arquivo SQLite real', () => {
  let directory: string;
  let databasePath: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'enlace-sqlite-'));
    databasePath = path.join(directory, 'enlace.db');
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('dados e fila sobrevivem ao fechamento e reabertura do banco', async () => {
    const first = new BetterSqliteDriver(new Database(databasePath));
    await applyMigrations(first);
    const animalRepository = new SqliteAnimalRepository(first);
    await animalRepository.saveLocal(makeAnimal({ id: 'persistente' }));
    await new SqliteSyncQueueRepository(first).enqueue(
      new SyncAction({
        id: 'sync_persistente',
        operation: 'CREATE',
        entityType: 'animal',
        entityId: 'persistente',
        payload: { name: 'Luna' },
      })
    );
    first.close();

    const second = new BetterSqliteDriver(new Database(databasePath));
    expect(await getSchemaVersion(second)).toBe(LATEST_SCHEMA_VERSION);
    const animal = await new SqliteAnimalRepository(second).findById('persistente');
    expect(animal?.name).toBe('Luna');
    const action = await new SqliteSyncQueueRepository(second).findById('sync_persistente');
    expect(action?.payload).toEqual({ name: 'Luna' });
    second.close();
  });

  it('container não repopula o seed ao reabrir o mesmo arquivo e preserva dados do usuário', async () => {
    const first = new BetterSqliteDriver(new Database(databasePath));
    const firstContainer = await loadAppContainer(first);
    expect(firstContainer.mode).toBe('sqlite');
    expect(await firstContainer.animalRepository.search({})).toHaveLength(7);

    await firstContainer.animalRepository.saveLocal(makeAnimal({ id: 'animal_usuario' }));
    first.close();

    const second = new BetterSqliteDriver(new Database(databasePath));
    const secondContainer = await loadAppContainer(second);
    const all = await secondContainer.animalRepository.search({});
    expect(all).toHaveLength(8);
    expect(all.map((a) => a.id)).toContain('animal_usuario');
    second.close();
  });
});
