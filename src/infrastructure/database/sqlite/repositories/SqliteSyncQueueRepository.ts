import { asc, eq } from 'drizzle-orm';
import type { SyncAction } from '../../../../domain/entities/SyncAction';
import type { SyncQueueRepository } from '../../../../domain/ports/SyncQueueRepository';
import type { AppDatabase } from '../connection';
import { syncQueue } from '../schema';
import { actionToRow, rowToAction } from '../mappers';

// `listPending` espelha `SyncQueueRepositoryFake.listPending`: elegíveis são
// PENDING ou FAILED (doc §14.1 passo 3), ordenados por data de alteração.
export class SqliteSyncQueueRepository implements SyncQueueRepository {
  constructor(private readonly db: AppDatabase) {}

  async enqueue(action: SyncAction): Promise<void> {
    await this.db.insert(syncQueue).values(actionToRow(action));
  }

  async listPending(): Promise<SyncAction[]> {
    const rows = await this.db
      .select()
      .from(syncQueue)
      .orderBy(asc(syncQueue.changedAt), asc(syncQueue.id));
    return rows
      .filter((row) => row.status === 'PENDING' || row.status === 'FAILED')
      .map(rowToAction);
  }

  async findById(id: string): Promise<SyncAction | null> {
    const rows = await this.db.select().from(syncQueue).where(eq(syncQueue.id, id)).limit(1);
    return rows.length === 0 ? null : rowToAction(rows[0]);
  }

  async update(action: SyncAction): Promise<void> {
    const row = actionToRow(action);
    const { id: _ignored, ...updatable } = row;
    await this.db.update(syncQueue).set(updatable).where(eq(syncQueue.id, action.id));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(syncQueue).where(eq(syncQueue.id, id));
  }

  async clearCompleted(): Promise<void> {
    await this.db.delete(syncQueue).where(eq(syncQueue.status, 'COMPLETED'));
  }
}
