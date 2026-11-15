import { SyncMetadata } from '../../../../domain/entities/SyncMetadata';
import { SyncMetadataRepository } from '../../../../domain/ports/SyncMetadataRepository';
import { SqliteDatabaseDriver } from '../DatabaseDriver';

interface SyncMetadataRow {
  key: string;
  last_sync_at: string;
  cursor_id: string | null;
  version: number;
}

export class SqliteSyncMetadataRepository implements SyncMetadataRepository {
  constructor(private db: SqliteDatabaseDriver) {}

  async get(key: string): Promise<SyncMetadata | null> {
    const row = await this.db.getFirstAsync<SyncMetadataRow>(
      'SELECT * FROM sync_metadata WHERE key = ?',
      [key]
    );
    if (!row) return null;
    return new SyncMetadata({
      key: row.key,
      lastSyncAt: row.last_sync_at,
      cursorId: row.cursor_id ?? undefined,
      version: Number(row.version) || 1,
    });
  }

  async save(metadata: SyncMetadata): Promise<void> {
    await this.db.runAsync(
      'INSERT OR REPLACE INTO sync_metadata (key, last_sync_at, cursor_id, version) VALUES (?, ?, ?, ?)',
      [metadata.key, metadata.lastSyncAt, metadata.cursorId ?? null, metadata.version]
    );
  }
}
