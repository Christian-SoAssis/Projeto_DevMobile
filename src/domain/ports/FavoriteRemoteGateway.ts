import { Favorite } from '../entities/Favorite';

export interface FavoriteRemoteGateway {
  listByUser(userId: string): Promise<Favorite[]>;
  upsert(favorite: Favorite): Promise<void>;
  remove(userId: string, animalId: string): Promise<void>;
}
