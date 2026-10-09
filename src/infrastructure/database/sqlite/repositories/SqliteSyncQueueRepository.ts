import { SyncAction, SyncOperation, SyncEntityType } from '../../../../domain/entities/SyncAction';
import { SyncQueueRepository } from '../../../../domain/ports/SyncQueueRepository';
import { SyncState } from '../../../../domain/value-objects/SyncState';
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
      `INSERT INTO sync_queue (
        id, operation, entity_type, entity_id, payload_json, changed_at, attempts, status, last_error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        action.id,
        action.operation,
        action.entityType,
        action.entityId,
        JSON.stringify(action.payload),
        action.changedAt,
        action.attempts,
        action.status.value,
        action.lastError || null,
      ]
    );
  }

  async listPending(): Promise<SyncAction[]> {
    const rows = await this.db.getAllAsync<SyncQueueRow>(
      `SELECT * FROM sync_queue WHERE status = 'PENDING' OR status = 'FAILED' ORDER BY changed_at ASC`
    );

    return rows.map((r) => this.mapToEntity(r));
  }

  async findById(id: string): Promise<SyncAction | null> {
    const row = await this.db.getFirstAsync<SyncQueueRow>(
      `SELECT * FROM sync_queue WHERE id = ?`,
      [id]
    );
    if (!row) return null;
    return this.mapToEntity(row);
  }

  async update(action: SyncAction): Promise<void> {
    await this.db.runAsync(
      `UPDATE sync_queue SET
        attempts = ?, status = ?, last_error = ?
       WHERE id = ?`,
      [action.attempts, action.status.value, action.lastError || null, action.id]
    );
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [id]);
  }

  async clearCompleted(): Promise<void> {
    await this.db.runAsync(`DELETE FROM sync_queue WHERE status = 'COMPLETED'`);
  }

  private mapToEntity(row: SyncQueueRow): SyncAction {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(row.payload_json);
    } catch {
      payload = {};
    }

    const rawStatus = (row.status || 'PENDING').toUpperCase() as any;
    const status = new SyncState(rawStatus);

    return new SyncAction({
      id: row.id,
      operation: row.operation as SyncOperation,
      entityType: row.entity_type as SyncEntityType,
      entityId: row.entity_id,
      payload,
      changedAt: row.changed_at,
      attempts: Number(row.attempts) || 0,
      status,
      lastError: row.last_error || undefined,
    });
  }
}
