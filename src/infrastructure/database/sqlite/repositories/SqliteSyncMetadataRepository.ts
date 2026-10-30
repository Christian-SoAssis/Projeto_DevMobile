import { SyncMetadata } from '../../../../domain/entities/SyncMetadata';
import { SyncMetadataRepository } from '../../../../domain/ports/SyncMetadataRepository';
import { SqliteDatabaseDriver } from '../DatabaseDriver';

interface SyncStateRow {
  key: string;
  last_sync_at: string | null;
  last_success_at: string | null;
}

export class SqliteSyncMetadataRepository implements SyncMetadataRepository {
  constructor(private db: SqliteDatabaseDriver) {}

  async findByKey(key: string): Promise<SyncMetadata | null> {
    const row = await this.db.getFirstAsync<SyncStateRow>(
      'SELECT * FROM sync_state WHERE key = ?',
      [key]
    );
    if (!row) return null;

    return new SyncMetadata({
      key: row.key,
      lastSyncAt: row.last_sync_at || undefined,
      lastSuccessAt: row.last_success_at || undefined,
    });
  }

  async save(metadata: SyncMetadata): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO sync_state (key, last_sync_at, last_success_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         last_sync_at = excluded.last_sync_at,
         last_success_at = excluded.last_success_at`,
      [metadata.key, metadata.lastSyncAt || null, metadata.lastSuccessAt || null]
    );
  }
}
