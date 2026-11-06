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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        operation = excluded.operation,
        entity_type = excluded.entity_type,
        entity_id = excluded.entity_id,
        payload_json = excluded.payload_json,
        changed_at = excluded.changed_at,
        attempts = excluded.attempts,
        status = excluded.status,
        last_error = excluded.last_error`,
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

  async enqueueAnimalUpdate(action: SyncAction): Promise<void> {
    // Supersede (OFF-07/T07): remove edições anteriores pendentes do MESMO
    // animal — a revisão mais nova contém todo o estado atual, reenviar a
    // antiga é redundante e sua "confirmação" corresponderia a conteúdo
    // nunca enviado. Preserva itens EM CONFLITO (aguardam revisão manual,
    // doc §9.4) e CREATE (o pai precisa subir). SYNCING não está em
    // `listPending` (PENDING/FAILED) e não é tocado. O filtro é feito na
    // aplicação (e não em SQL avançado) para o comportamento ser idêntico
    // em todos os drivers (real e in-memory).
    const pending = await this.listPending();
    for (const existing of pending) {
      if (
        existing.entityType === 'animal' &&
        existing.entityId === action.entityId &&
        (existing.operation === 'UPDATE' || existing.operation === 'MARK_ADOPTED') &&
        !existing.isConflict
      ) {
        await this.delete(existing.id);
      }
    }
    await this.enqueue(action);
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
