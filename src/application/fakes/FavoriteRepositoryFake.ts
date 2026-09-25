import { Favorite } from '../../domain/entities/Favorite';
import { FavoriteRepository } from '../../domain/ports/FavoriteRepository';

export class FavoriteRepositoryFake implements FavoriteRepository {
  public favorites: Favorite[] = [];

  async addFavorite(favorite: Favorite): Promise<void> {
    const exists = await this.isFavorite(favorite.userId, favorite.animalId);
    if (!exists) {
      this.favorites.push(favorite);
    }
  }

  async removeFavorite(userId: string, animalId: string): Promise<void> {
    this.favorites = this.favorites.filter(
      (f) => !(f.userId === userId && f.animalId === animalId)
    );
  }

  async listByUser(userId: string): Promise<Favorite[]> {
    return this.favorites.filter((f) => f.userId === userId);
  }

  async isFavorite(userId: string, animalId: string): Promise<boolean> {
    return this.favorites.some((f) => f.userId === userId && f.animalId === animalId);
  }
}
