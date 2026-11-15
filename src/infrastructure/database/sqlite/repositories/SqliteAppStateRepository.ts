import { AppStateRepository } from '../../../../domain/ports/AppStateRepository';
import { SqliteDatabaseDriver } from '../DatabaseDriver';

interface AppStateRow {
  key: string;
  value: string;
}

export class SqliteAppStateRepository implements AppStateRepository {
  constructor(private db: SqliteDatabaseDriver) {}

  async get(key: string): Promise<string | null> {
    const row = await this.db.getFirstAsync<AppStateRow>(
      'SELECT * FROM app_state WHERE key = ?',
      [key]
    );
    return row ? row.value : null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.db.runAsync(
      'INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)',
      [key, value]
    );
  }
}
