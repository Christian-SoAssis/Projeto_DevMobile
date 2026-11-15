import { SyncMetadata } from '../../domain/entities/SyncMetadata';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { DeltaCursor, RemoteAnimalSource } from '../../domain/ports/RemoteAnimalSource';
import { SyncMetadataRepository } from '../../domain/ports/SyncMetadataRepository';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';

export interface PullRemoteAnimalsOptions {
  currentUserId?: () => string | null;
}

export interface PullRemoteResult {
  upserted: number;
  removed: number;
}

const ANIMALS_CURSOR_KEY = 'animals_delta_cursor';
const TOMBSTONES_CURSOR_KEY = 'animals_tombstones_cursor';

/**
 * Recebimento incremental (Delta Sync) e tombstones (OFF-06, OFF-08).
 * - Não sobrescreve rascunho/edição local que ainda está pendente na `sync_queue`.
 * - Só avança o cursor após persistir todos os itens do lote.
 */
export class PullRemoteAnimalsUseCase {
  constructor(
    private remoteAnimalSource: RemoteAnimalSource,
    private animalRepository: AnimalRepository,
    private syncQueueRepository: SyncQueueRepository,
    private syncMetadataRepository: SyncMetadataRepository,
    private pageSize: number = 100,
    private options: PullRemoteAnimalsOptions = {}
  ) {}

  async execute(): Promise<PullRemoteResult> {
    const pendingActions = await this.syncQueueRepository.listPending();
    const pendingAnimalIds = new Set(
      pendingActions.filter((a) => a.entityType === 'animal').map((a) => a.entityId)
    );

    let upserted = 0;
    let removed = 0;

    // 1. Pull de animais visíveis modificados após o último cursor
    const savedMeta = await this.syncMetadataRepository.get(ANIMALS_CURSOR_KEY);
    let cursor: DeltaCursor | null = savedMeta
      ? {
          updatedAt: this.withOverlap(savedMeta.lastSyncAt),
          id: savedMeta.cursorId ?? '00000000-0000-0000-0000-000000000000',
        }
      : null;

    const existingLocal = await this.animalRepository.search({});
    if (existingLocal.length === 0) {
      cursor = null;
    }

    let hasMore = true;
    while (hasMore) {
      const page = await this.remoteAnimalSource.listVisibleChangedAfter(cursor, this.pageSize);
      const safeToUpsert = page.animals.filter((remote) => !pendingAnimalIds.has(remote.id));

      if (safeToUpsert.length > 0) {
        await this.animalRepository.upsertCache(safeToUpsert);
        upserted += safeToUpsert.length;
      }

      if (page.nextCursor) {
        await this.syncMetadataRepository.save(
          new SyncMetadata({
            key: ANIMALS_CURSOR_KEY,
            lastSyncAt: page.nextCursor.updatedAt,
            cursorId: page.nextCursor.id,
          })
        );
        cursor = page.nextCursor;
        hasMore = page.animals.length >= this.pageSize;
      } else {
        hasMore = false;
      }
    }

    // 2. Pull de tombstones (exclusões / ocultações remotas)
    if (this.remoteAnimalSource.listTombstonesAfter) {
      const tombMeta = await this.syncMetadataRepository.get(TOMBSTONES_CURSOR_KEY);
      const tombCursor: DeltaCursor | null = tombMeta
        ? {
            updatedAt: tombMeta.lastSyncAt,
            id: tombMeta.cursorId ?? '00000000-0000-0000-0000-000000000000',
          }
        : null;

      const tombPage = await this.remoteAnimalSource.listTombstonesAfter(tombCursor, this.pageSize);
      const activeUserId = this.options.currentUserId ? this.options.currentUserId() : null;

      for (const tomb of tombPage.tombstones) {
        if (pendingAnimalIds.has(tomb.animalId)) continue;
        const local = await this.animalRepository.findById(tomb.animalId);
        if (!local) continue;
        if (tomb.reason === 'HIDDEN' && activeUserId && local.ownerId === activeUserId) {
          continue;
        }
        await this.animalRepository.deleteLocal(tomb.animalId);
        removed += 1;
      }

      if (tombPage.nextCursor) {
        await this.syncMetadataRepository.save(
          new SyncMetadata({
            key: TOMBSTONES_CURSOR_KEY,
            lastSyncAt: tombPage.nextCursor.updatedAt,
            cursorId: tombPage.nextCursor.id,
          })
        );
      }
    }

    return { upserted, removed };
  }

  /** Sobreposição de 60 s ao retomar para tolerar pequenas diferenças de transação (OFF-06). */
  private withOverlap(isoTimestamp: string): string {
    const ms = Date.parse(isoTimestamp);
    if (Number.isNaN(ms)) return isoTimestamp;
    return new Date(Math.max(0, ms - 60_000)).toISOString();
  }
}
