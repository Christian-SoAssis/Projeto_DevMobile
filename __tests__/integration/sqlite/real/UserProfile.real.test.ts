/**
 * @jest-environment node
 */
import { BetterSqliteDriver } from '../../../../test-support/BetterSqliteDriver';
import { applyMigrations, getSchemaVersion, LATEST_SCHEMA_VERSION } from '../../../../src/infrastructure/database/sqlite/migrations';
import { SqliteUserRepository } from '../../../../src/infrastructure/database/sqlite/repositories/SqliteUserRepository';
import { User } from '../../../../src/domain/entities/User';
import { ContactInfo } from '../../../../src/domain/value-objects/ContactInfo';

describe('Perfil do usuário no SQLite real (migração 2)', () => {
  let driver: BetterSqliteDriver;

  beforeEach(async () => {
    driver = new BetterSqliteDriver();
    await applyMigrations(driver);
  });
  afterEach(() => driver.close());

  const make = (extra: Partial<ConstructorParameters<typeof User>[0]> = {}) =>
    new User({ id: 'u1', name: 'Ana', contactInfo: new ContactInfo('ana@x.com', '11999'), ...extra });

  it('a migração 2 cria as colunas de perfil', async () => {
    expect(await getSchemaVersion(driver)).toBe(LATEST_SCHEMA_VERSION);
    const cols = await driver.getAllAsync<{ name: string }>('PRAGMA table_info(users)');
    expect(cols.map((c) => c.name)).toEqual(expect.arrayContaining(['bio', 'avatar_uri', 'interests']));
  });

  it('grava e lê descrição, foto e interesses; atualizar não duplica', async () => {
    const repo = new SqliteUserRepository(driver);
    await repo.save(make({ bio: 'Amo animais', avatarUri: 'file:///a.jpg', interests: ['Cães', 'Filhotes'] }));

    const loaded = await repo.findById('u1');
    expect(loaded?.bio).toBe('Amo animais');
    expect(loaded?.avatarUri).toBe('file:///a.jpg');
    expect(loaded?.interests).toEqual(['Cães', 'Filhotes']);

    await repo.save(make({ bio: 'Mudei', interests: [] }));
    const updated = await repo.findById('u1');
    expect(updated?.bio).toBe('Mudei');
    expect(updated?.avatarUri).toBeUndefined();
    expect(updated?.interests).toEqual([]);
    const count = await driver.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM users');
    expect(count?.n).toBe(1);
  });

  it('interesses corrompidos no banco viram lista vazia (não quebram o app)', async () => {
    await driver.runAsync(
      `INSERT INTO users (id, name, email, user_type, interests, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      ['u2', 'Bia', 'bia@x.com', 'USER', '{lixo', new Date().toISOString()]
    );
    const repo = new SqliteUserRepository(driver);
    expect((await repo.findById('u2'))?.interests).toEqual([]);
    await driver.runAsync(`UPDATE users SET interests = ? WHERE id = ?`, ['"texto"', 'u2']);
    expect((await repo.findById('u2'))?.interests).toEqual([]);
  });

  it('banco legado (versão 1, sem as colunas) é migrado preservando os usuários', async () => {
    const legacy = new BetterSqliteDriver();
    await legacy.execAsync(
      `CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
        phone TEXT, user_type TEXT NOT NULL DEFAULT 'USER', created_at TEXT NOT NULL)`
    );
    await legacy.runAsync(
      `INSERT INTO users (id, name, email, created_at) VALUES ('old', 'Velho', 'v@x.com', '2026-01-01')`
    );
    await legacy.execAsync('PRAGMA user_version = 1');
    await applyMigrations(legacy);
    expect(await getSchemaVersion(legacy)).toBe(LATEST_SCHEMA_VERSION);
    const user = await new SqliteUserRepository(legacy).findById('old');
    expect(user?.name).toBe('Velho');
    expect(user?.interests).toEqual([]);
    legacy.close();
  });
});
