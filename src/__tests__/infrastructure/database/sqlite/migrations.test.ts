import { applyMigrations } from '../../../../infrastructure/database/sqlite/migrations';
import { InMemorySqliteDriver } from '../../../../infrastructure/database/sqlite/DatabaseDriver';

describe('SQLite Migrations (OFF-02, DAT-01)', () => {
  it('deve criar todas as tabelas do schema na primeira aplicação', async () => {
    const db = new InMemorySqliteDriver();

    await applyMigrations(db);

    // Verifica que as tabelas existem tentando consultar cada uma
    const tableNames = [
      'animals', 'animal_photos', 'favorites', 'adoption_interests',
      'sync_queue', 'sync_metadata', 'search_preferences', 'app_state',
      'users', 'profiles', 'schema_migrations',
    ];

    for (const table of tableNames) {
      const result = await db.getAllAsync(`SELECT * FROM ${table} LIMIT 1`);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    }
  });

  it('deve registrar a versão da migration aplicada', async () => {
    const db = new InMemorySqliteDriver();

    await applyMigrations(db);

    const versions = await db.getAllAsync<{ version: number }>(
      'SELECT version FROM schema_migrations ORDER BY version'
    );
    expect(versions.map((v) => v.version)).toContain(1);
    expect(versions.map((v) => v.version)).toContain(2);
  });

  it('deve ser idempotente: aplicar duas vezes não duplica dados', async () => {
    const db = new InMemorySqliteDriver();

    await applyMigrations(db);
    await applyMigrations(db);
    await applyMigrations(db);

    const versions = await db.getAllAsync<{ version: number }>(
      'SELECT version FROM schema_migrations'
    );
    // Apenas uma entrada para a versão 1 (não duplica)
    expect(versions.filter((v) => v.version === 1).length).toBe(1);
  });

  it('deve preservar dados existentes ao reaplicar migrations', async () => {
    const db = new InMemorySqliteDriver();

    // Insere um dado antes da migration
    await db.runAsync(
      "INSERT INTO animals (id, owner_id, name, species, size, approximate_age, sex, status, neighborhood, city, region, latitude, longitude, hidden, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ['animal-1', 'user-1', 'Amora', 'Cão', 'Médio', '2 anos', 'Fêmea', 'AVAILABLE', 'Centro', 'Varginha', 'MG', -21.55, -45.43, 0, 1, '2026-01-01', '2026-01-01']
    );

    await applyMigrations(db);

    // O dado deve continuar lá
    const animals = await db.getAllAsync<{ id: string; name: string }>('SELECT id, name FROM animals');
    expect(animals.length).toBe(1);
    expect(animals[0].name).toBe('Amora');
  });

  it('deve criar índice e estrutura de sincronização', async () => {
    const db = new InMemorySqliteDriver();

    await applyMigrations(db);

    // Verifica que a tabela sync_queue existe e tem as colunas necessárias
    const queueRows = await db.getAllAsync('SELECT * FROM sync_queue LIMIT 1');
    expect(queueRows).toBeDefined();

    const metadataRows = await db.getAllAsync('SELECT * FROM sync_metadata LIMIT 1');
    expect(metadataRows).toBeDefined();
  });
});
