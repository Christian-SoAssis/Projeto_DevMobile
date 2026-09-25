import { Favorite } from '../entities/Favorite';

export interface FavoriteRepository {
  addFavorite(favorite: Favorite): Promise<void>;
  removeFavorite(userId: string, animalId: string): Promise<void>;
  listByUser(userId: string): Promise<Favorite[]>;
  isFavorite(userId: string, animalId: string): Promise<boolean>;
}
