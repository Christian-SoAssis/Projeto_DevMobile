/**
 * @jest-environment node
 */
import { BetterSqliteDriver } from '../../../../test-support/BetterSqliteDriver';
import {
  applyMigrations,
  getSchemaVersion,
  LATEST_SCHEMA_VERSION,
} from '../../../../src/infrastructure/database/sqlite/migrations';
import { INITIAL_SCHEMA_SQL } from '../../../../src/infrastructure/database/sqlite/migrations/schema.sql';

describe('Migrations SQLite reais', () => {
  let driver: BetterSqliteDriver;

  beforeEach(() => {
    driver = new BetterSqliteDriver();
  });

  afterEach(() => {
    driver.close();
  });

  it('aplica o schema inicial, cria tabelas/índices e grava user_version', async () => {
    expect(await getSchemaVersion(driver)).toBe(0);

    await applyMigrations(driver);

    expect(await getSchemaVersion(driver)).toBe(LATEST_SCHEMA_VERSION);

    const tables = await driver.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table'`
    );
    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        'animals',
        'animal_photos',
        'favorites',
        'adoption_interests',
        'users',
        'sync_queue',
        'local_images',
        'sync_state',
        'search_preferences',
      ])
    );

    const indexes = await driver.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'index'`
    );
    expect(indexes.map((i) => i.name)).toEqual(
      expect.arrayContaining([
        'idx_animals_owner_id',
        'idx_animals_status',
        'idx_animal_photos_animal_id',
        'idx_favorites_user_id',
        'idx_interests_user_id',
        'idx_interests_animal_id',
        'idx_sync_queue_status_changed_at',
      ])
    );
  });

  it('é idempotente: reaplicar não duplica estrutura nem muda a versão', async () => {
    await applyMigrations(driver);
    const before = await driver.getAllAsync(`SELECT name FROM sqlite_master ORDER BY name`);

    await applyMigrations(driver);

    const after = await driver.getAllAsync(`SELECT name FROM sqlite_master ORDER BY name`);
    expect(after).toEqual(before);
    expect(await getSchemaVersion(driver)).toBe(LATEST_SCHEMA_VERSION);
  });

  it('migra banco legado (user_version 0) preservando os dados existentes', async () => {
    await driver.execAsync(INITIAL_SCHEMA_SQL);
    await driver.runAsync(
      `INSERT INTO search_preferences (user_id, species, updated_at) VALUES (?, ?, ?)`,
      ['user_legado', 'Gato', '2026-01-01T00:00:00.000Z']
    );

    // Simula banco criado antes do controle de versão.
    await driver.execAsync('PRAGMA user_version = 0');
    expect(await getSchemaVersion(driver)).toBe(0);

    await applyMigrations(driver);

    expect(await getSchemaVersion(driver)).toBe(LATEST_SCHEMA_VERSION);
    const row = await driver.getFirstAsync<{ user_id: string; species: string }>(
      `SELECT user_id, species FROM search_preferences WHERE user_id = ?`,
      ['user_legado']
    );
    expect(row).toEqual({ user_id: 'user_legado', species: 'Gato' });
  });
});
