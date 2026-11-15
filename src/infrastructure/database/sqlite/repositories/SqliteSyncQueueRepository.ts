import {
  SyncAction,
  SyncEntityType,
  SyncOperationType,
} from '../../../../domain/entities/SyncAction';
import { SyncStateType } from '../../../../domain/value-objects/SyncState';
import { SyncQueueRepository } from '../../../../domain/ports/SyncQueueRepository';
import { SqliteDatabaseDriver } from '../DatabaseDriver';

interface SyncQueueRow {
  id: string;
  operation: string;
  entity_type: string;
  entity_id: string;
  payload_json: string;
  changed_at: string;
  attempts: number;
  status: string;
  last_error: string | null;
}

export class SqliteSyncQueueRepository implements SyncQueueRepository {
  constructor(private db: SqliteDatabaseDriver) {}

  async enqueue(action: SyncAction): Promise<void> {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO sync_queue (
        id, operation, entity_type, entity_id, payload_json, changed_at, attempts, status, last_error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        action.id,
        action.operation,
        action.entityType,
        action.entityId,
        JSON.stringify(action.payload ?? {}),
        action.changedAt,
        action.attempts,
        action.status.value,
        action.lastError ?? null,
      ]
    );
  }

  async listPending(): Promise<SyncAction[]> {
    const rows = await this.db.getAllAsync<SyncQueueRow>('SELECT * FROM sync_queue');
    return rows
      .filter((r) => r.status !== 'COMPLETED')
      .sort((a, b) => (a.changed_at > b.changed_at ? 1 : -1))
      .map((r) => this.mapRow(r));
  }

  async findById(id: string): Promise<SyncAction | null> {
    const row = await this.db.getFirstAsync<SyncQueueRow>(
      'SELECT * FROM sync_queue WHERE id = ?',
      [id]
    );
    return row ? this.mapRow(row) : null;
  }

  async update(action: SyncAction): Promise<void> {
    await this.enqueue(action);
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
  }

  private mapRow(row: SyncQueueRow): SyncAction {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(row.payload_json || '{}');
    } catch {
      payload = {};
    }
    return new SyncAction({
      id: row.id,
      operation: row.operation as SyncOperationType,
      entityType: row.entity_type as SyncEntityType,
      entityId: row.entity_id,
      payload,
      changedAt: row.changed_at,
      attempts: Number(row.attempts) || 0,
      status: (row.status as SyncStateType) || 'PENDING',
      lastError: row.last_error ?? undefined,
    });
  }
}
