import { Favorite } from '../../../../domain/entities/Favorite';
import { FavoriteRepository } from '../../../../domain/ports/FavoriteRepository';
import { SqliteDatabaseDriver } from '../DatabaseDriver';

interface FavoriteRow {
  id: string;
  user_id: string;
  animal_id: string;
  created_at: string;
}

export class SqliteFavoriteRepository implements FavoriteRepository {
  constructor(private db: SqliteDatabaseDriver) {}

  async addFavorite(favorite: Favorite): Promise<void> {
    const id = `${favorite.userId}_${favorite.animalId}`;
    await this.db.runAsync(
      `INSERT INTO favorites (id, user_id, animal_id, created_at) VALUES (?, ?, ?, ?)`,
      [id, favorite.userId, favorite.animalId, favorite.createdAt]
    );
  }

  async removeFavorite(userId: string, animalId: string): Promise<void> {
    await this.db.runAsync(
      `DELETE FROM favorites WHERE user_id = ? AND animal_id = ?`,
      [userId, animalId]
    );
  }

  async listByUser(userId: string): Promise<Favorite[]> {
    const rows = await this.db.getAllAsync<FavoriteRow>(
      `SELECT * FROM favorites WHERE user_id = ?`,
      [userId]
    );

    return rows.map((r) => new Favorite(r.user_id, r.animal_id, r.created_at));
  }

  async isFavorite(userId: string, animalId: string): Promise<boolean> {
    const row = await this.db.getFirstAsync<FavoriteRow>(
      `SELECT * FROM favorites WHERE user_id = ? AND animal_id = ?`,
      [userId, animalId]
    );
    return !!row;
  }
}
