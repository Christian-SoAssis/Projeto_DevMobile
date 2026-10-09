import { User } from '../../../src/domain/entities/User';
import { ContactInfo } from '../../../src/domain/value-objects/ContactInfo';
import { InMemorySqliteDriver } from '../../../src/infrastructure/database/sqlite/DatabaseDriver';
import { INITIAL_SCHEMA_SQL } from '../../../src/infrastructure/database/sqlite/migrations/schema.sql';
import { SqliteUserRepository } from '../../../src/infrastructure/database/sqlite/repositories/SqliteUserRepository';

describe('SqliteUserRepository', () => {
  let db: InMemorySqliteDriver;
  let repository: SqliteUserRepository;

  beforeEach(async () => {
    db = new InMemorySqliteDriver();
    await db.execAsync(INITIAL_SCHEMA_SQL);
    repository = new SqliteUserRepository(db);
  });

  it('salva usuário e o recupera por ID e e-mail', async () => {
    const user = new User({
      id: 'u1',
      name: 'Maria Silva',
      contactInfo: new ContactInfo('maria@exemplo.com', '35999998888'),
      role: 'USER',
    });

    await repository.save(user);

    const byId = await repository.findById('u1');
    expect(byId).not.toBeNull();
    expect(byId?.name).toBe('Maria Silva');
    expect(byId?.contactInfo.email).toBe('maria@exemplo.com');

    const byEmail = await repository.findByEmail('MARIA@EXEMPLO.COM');
    expect(byEmail).not.toBeNull();
    expect(byEmail?.id).toBe('u1');
  });
});
