import { AdoptionInterest } from '../../../src/domain/entities/AdoptionInterest';
import { InMemorySqliteDriver } from '../../../src/infrastructure/database/sqlite/DatabaseDriver';
import { INITIAL_SCHEMA_SQL } from '../../../src/infrastructure/database/sqlite/migrations/schema.sql';
import { SqliteAdoptionInterestRepository } from '../../../src/infrastructure/database/sqlite/repositories/SqliteAdoptionInterestRepository';

describe('SqliteAdoptionInterestRepository', () => {
  let db: InMemorySqliteDriver;
  let repository: SqliteAdoptionInterestRepository;

  beforeEach(async () => {
    db = new InMemorySqliteDriver();
    await db.execAsync(INITIAL_SCHEMA_SQL);
    repository = new SqliteAdoptionInterestRepository(db);
  });

  it('registra e consulta manifestações de interesse de adoção', async () => {
    const interest = new AdoptionInterest('int_1', 'u1', 'a1');
    await repository.registerInterest(interest);

    expect(await repository.hasInterest('u1', 'a1')).toBe(true);
    expect(await repository.hasInterest('u1', 'a2')).toBe(false);

    const userInterests = await repository.listByUser('u1');
    expect(userInterests).toHaveLength(1);
    expect(userInterests[0].animalId).toBe('a1');

    const animalInterests = await repository.listByAnimal('a1');
    expect(animalInterests).toHaveLength(1);
    expect(animalInterests[0].userId).toBe('u1');
  });
});
