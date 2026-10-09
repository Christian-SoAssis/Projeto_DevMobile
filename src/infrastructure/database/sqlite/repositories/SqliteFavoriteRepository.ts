import { and, asc, eq } from 'drizzle-orm';
import type { Favorite } from '../../../../domain/entities/Favorite';
import type { FavoriteRepository } from '../../../../domain/ports/FavoriteRepository';
import type { AppDatabase } from '../connection';
import { favorites } from '../schema';
import { favoriteToRow, rowToFavorite } from '../mappers';

export class SqliteFavoriteRepository implements FavoriteRepository {
  constructor(private readonly db: AppDatabase) {}

  async addFavorite(favorite: Favorite): Promise<void> {
    await this.db.insert(favorites).values(favoriteToRow(favorite)).onConflictDoNothing();
  }

  async removeFavorite(userId: string, animalId: string): Promise<void> {
    await this.db
      .delete(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.animalId, animalId)));
  }

  async listByUser(userId: string): Promise<Favorite[]> {
    const rows = await this.db
      .select()
      .from(favorites)
      .where(eq(favorites.userId, userId))
      .orderBy(asc(favorites.createdAt));
    return rows.map(rowToFavorite);
  }

  async isFavorite(userId: string, animalId: string): Promise<boolean> {
    const rows = await this.db
      .select({ userId: favorites.userId })
      .from(favorites)
      .where(and(eq(favorites.userId, userId), eq(favorites.animalId, animalId)))
      .limit(1);
    return rows.length > 0;
  }
}
