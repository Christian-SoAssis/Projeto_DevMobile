import { Favorite } from '../../../src/domain/entities/Favorite';
import { InMemorySqliteDriver } from '../../../src/infrastructure/database/sqlite/DatabaseDriver';
import { INITIAL_SCHEMA_SQL } from '../../../src/infrastructure/database/sqlite/migrations/schema.sql';
import { SqliteFavoriteRepository } from '../../../src/infrastructure/database/sqlite/repositories/SqliteFavoriteRepository';

describe('SqliteFavoriteRepository', () => {
  let db: InMemorySqliteDriver;
  let repository: SqliteFavoriteRepository;

  beforeEach(async () => {
    db = new InMemorySqliteDriver();
    await db.execAsync(INITIAL_SCHEMA_SQL);
    repository = new SqliteFavoriteRepository(db);
  });

  it('adiciona e verifica favoritos por usuário', async () => {
    const fav1 = new Favorite('u1', 'a1');
    const fav2 = new Favorite('u1', 'a2');

    await repository.addFavorite(fav1);
    await repository.addFavorite(fav2);

    expect(await repository.isFavorite('u1', 'a1')).toBe(true);
    expect(await repository.isFavorite('u1', 'a2')).toBe(true);
    expect(await repository.isFavorite('u1', 'a3')).toBe(false);

    const userFavs = await repository.listByUser('u1');
    expect(userFavs).toHaveLength(2);
    expect(userFavs.map((f) => f.animalId)).toEqual(['a1', 'a2']);
  });

  it('remove favorito com sucesso', async () => {
    const fav = new Favorite('u1', 'a1');
    await repository.addFavorite(fav);
    expect(await repository.isFavorite('u1', 'a1')).toBe(true);

    await repository.removeFavorite('u1', 'a1');
    expect(await repository.isFavorite('u1', 'a1')).toBe(false);
  });
});
