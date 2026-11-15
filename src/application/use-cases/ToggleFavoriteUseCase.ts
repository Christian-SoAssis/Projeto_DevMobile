import { Favorite } from '../../domain/entities/Favorite';
import { SyncAction } from '../../domain/entities/SyncAction';
import { FavoriteRepository } from '../../domain/ports/FavoriteRepository';
import { FavoriteRemoteGateway } from '../../domain/ports/FavoriteRemoteGateway';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';

export class ToggleFavoriteUseCase {
  constructor(
    private favoriteRepository: FavoriteRepository,
    private syncQueueRepository?: SyncQueueRepository,
    private remoteFavorites?: FavoriteRemoteGateway
  ) {}

  async execute(
    userId: string | null | undefined,
    animalId: string,
    isOnline: boolean = true
  ): Promise<{ favorited: boolean; synced: boolean }> {
    if (!userId) {
      throw new Error('É necessário estar autenticado para favoritar anúncios.');
    }

    const alreadyFavorite = await this.favoriteRepository.isFavorite(userId, animalId);
    const nextFavorited = !alreadyFavorite;

    if (nextFavorited) {
      const fav = new Favorite({ userId, animalId });
      await this.favoriteRepository.add(fav);

      if (isOnline && this.remoteFavorites) {
        try {
          await this.remoteFavorites.upsert(fav);
          return { favorited: true, synced: true };
        } catch (err) {
          await this.enqueueFavoriteSync('CREATE', userId, animalId, err);
          return { favorited: true, synced: false };
        }
      } else {
        await this.enqueueFavoriteSync('CREATE', userId, animalId);
        return { favorited: true, synced: false };
      }
    } else {
      await this.favoriteRepository.remove(userId, animalId);

      if (isOnline && this.remoteFavorites) {
        try {
          await this.remoteFavorites.remove(userId, animalId);
          return { favorited: false, synced: true };
        } catch (err) {
          await this.enqueueFavoriteSync('DELETE', userId, animalId, err);
          return { favorited: false, synced: false };
        }
      } else {
        await this.enqueueFavoriteSync('DELETE', userId, animalId);
        return { favorited: false, synced: false };
      }
    }
  }

  private async enqueueFavoriteSync(
    operation: 'CREATE' | 'DELETE',
    userId: string,
    animalId: string,
    err?: unknown
  ): Promise<void> {
    if (!this.syncQueueRepository) return;
    const action = new SyncAction({
      id: `sync_fav_${operation}_${userId}_${animalId}`,
      operation,
      entityType: 'favorite',
      entityId: `${userId}:${animalId}`,
      payload: {
        ownerId: userId,
        userId,
        animalId,
      },
    });
    if (err instanceof Error) {
      action.markFailed(err.message);
    }
    await this.syncQueueRepository.enqueue(action);
  }
}
