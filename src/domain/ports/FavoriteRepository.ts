import { Favorite } from '../entities/Favorite';

export interface FavoriteRepository {
  listByUser(userId: string): Promise<Favorite[]>;
  isFavorite(userId: string, animalId: string): Promise<boolean>;
  add(favorite: Favorite): Promise<void>;
  remove(userId: string, animalId: string): Promise<void>;
}
