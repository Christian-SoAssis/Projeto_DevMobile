import { Favorite } from '../../domain/entities/Favorite';
import { SyncAction } from '../../domain/entities/SyncAction';
import { FavoriteRepository } from '../../domain/ports/FavoriteRepository';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { isUuid, newUuid } from '../../domain/services/IdGenerator';
import { UnitOfWork } from '../ports/UnitOfWork';
import { NoopUnitOfWork } from '../fakes/NoopUnitOfWork';

export class ToggleFavoriteUseCase {
  constructor(
    private favoriteRepository: FavoriteRepository,
    /** Sem fila, o favorito fica só no aparelho (modo demonstração/testes). */
    private syncQueueRepository?: SyncQueueRepository,
    private unitOfWork: UnitOfWork = new NoopUnitOfWork()
  ) {}

  async execute(userId: string, animalId: string): Promise<boolean> {
    if (!userId) throw new Error('Usuário autenticado é obrigatório para favoritar.');
    if (!animalId) throw new Error('ID do animal é obrigatório.');

    const isFav = await this.favoriteRepository.isFavorite(userId, animalId);

    // Outbox local: favorito + ação de fila entram juntos (RNF02/RNF03).
    await this.unitOfWork.run(async () => {
      if (isFav) {
        await this.favoriteRepository.removeFavorite(userId, animalId);
      } else {
        await this.favoriteRepository.addFavorite(new Favorite(userId, animalId));
      }
      await this.recordSyncIntent(userId, animalId, isFav ? 'DELETE' : 'CREATE');
    });
    return !isFav;
  }

  /**
   * Favoritar e desfavoritar antes de sincronizar se anulam: a ação
   * pendente oposta sai da fila e nada é enviado ao servidor.
   */
  private async recordSyncIntent(userId: string, animalId: string, operation: 'CREATE' | 'DELETE') {
    const queue = this.syncQueueRepository;
    if (!queue || !isUuid(animalId)) return;

    const entityId = `${userId}:${animalId}`;
    const pending = (await queue.listPending()).filter(
      (a) => a.entityType === 'favorite' && a.entityId === entityId && !a.status.isCompleted()
    );
    const opposite = pending.find((a) => a.operation !== operation);
    if (opposite) {
      await queue.delete(opposite.id);
      return;
    }
    if (pending.length > 0) return; // mesma intenção já está na fila

    await queue.enqueue(
      new SyncAction({
        id: `sync_fav_${newUuid()}`,
        operation,
        entityType: 'favorite',
        entityId,
        payload: { userId, animalId },
      })
    );
  }
}
