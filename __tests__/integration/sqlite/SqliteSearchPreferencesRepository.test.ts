import { InMemorySqliteDriver } from '../../../src/infrastructure/database/sqlite/DatabaseDriver';
import { INITIAL_SCHEMA_SQL } from '../../../src/infrastructure/database/sqlite/migrations/schema.sql';
import { SqliteSearchPreferencesRepository } from '../../../src/infrastructure/database/sqlite/repositories/SqliteSearchPreferencesRepository';

describe('SqliteSearchPreferencesRepository', () => {
  let db: InMemorySqliteDriver;
  let repository: SqliteSearchPreferencesRepository;

  beforeEach(async () => {
    db = new InMemorySqliteDriver();
    await db.execAsync(INITIAL_SCHEMA_SQL);
    repository = new SqliteSearchPreferencesRepository(db);
  });

  it('salva e recupera preferências de busca por usuário', async () => {
    await repository.save('u1', {
      species: 'Cão',
      size: 'Pequeno',
      searchQuery: 'Rex',
      radiusKm: 15,
    });

    const prefs = await repository.findByUserId('u1');
    expect(prefs).not.toBeNull();
    expect(prefs?.species).toBe('Cão');
    expect(prefs?.size).toBe('Pequeno');
    expect(prefs?.searchQuery).toBe('Rex');
    expect(prefs?.radiusKm).toBe(15);
  });
});
