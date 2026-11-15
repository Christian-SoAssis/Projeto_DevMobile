import { Favorite } from '../../../../domain/entities/Favorite';
import { FavoriteRepository } from '../../../../domain/ports/FavoriteRepository';
import { SqliteDatabaseDriver } from '../DatabaseDriver';

interface FavoriteRow {
  user_id: string;
  animal_id: string;
  created_at: string;
}

export class SqliteFavoriteRepository implements FavoriteRepository {
  constructor(private db: SqliteDatabaseDriver) {}

  async listByUser(userId: string): Promise<Favorite[]> {
    const rows = await this.db.getAllAsync<FavoriteRow>(
      'SELECT * FROM favorites WHERE user_id = ?',
      [userId]
    );
    return rows.map(
      (r) =>
        new Favorite({
          userId: r.user_id,
          animalId: r.animal_id,
          createdAt: r.created_at,
        })
    );
  }

  async isFavorite(userId: string, animalId: string): Promise<boolean> {
    const row = await this.db.getFirstAsync<FavoriteRow>(
      'SELECT * FROM favorites WHERE user_id = ? AND animal_id = ?',
      [userId, animalId]
    );
    return Boolean(row);
  }

  async add(favorite: Favorite): Promise<void> {
    await this.db.runAsync(
      'INSERT OR REPLACE INTO favorites (user_id, animal_id, created_at) VALUES (?, ?, ?)',
      [favorite.userId, favorite.animalId, favorite.createdAt]
    );
  }

  async remove(userId: string, animalId: string): Promise<void> {
    await this.db.runAsync(
      'DELETE FROM favorites WHERE user_id = ? AND animal_id = ?',
      [userId, animalId]
    );
  }
}
