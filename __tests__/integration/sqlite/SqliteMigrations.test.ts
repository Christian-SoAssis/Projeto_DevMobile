import { InMemorySqliteDriver } from '../../../src/infrastructure/database/sqlite/DatabaseDriver';
import { INITIAL_SCHEMA_SQL } from '../../../src/infrastructure/database/sqlite/migrations/schema.sql';

describe('SQLite Migrations', () => {
  it('criam todas as tabelas requeridas da Fase 2', async () => {
    const db = new InMemorySqliteDriver();
    await db.execAsync(INITIAL_SCHEMA_SQL);

    const tables = [
      'animals',
      'animal_photos',
      'favorites',
      'adoption_interests',
      'users',
      'sync_queue',
      'local_images',
      'sync_state',
      'search_preferences',
    ];

    for (const table of tables) {
      const rows = await db.getAllAsync(`SELECT * FROM ${table}`);
      expect(Array.isArray(rows)).toBe(true);
    }
  });
});
