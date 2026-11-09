import { AppStateRepository } from '../../../../domain/ports/AppStateRepository';
import { SqliteDatabaseDriver } from '../DatabaseDriver';

interface AppStateRow {
  key: string;
  value: string | null;
  updated_at?: string;
}

/**
 * Tabela `app_state` (decisão 20): sobrevive a reinícios — o badge de
 * notificações não-vistas NÃO é esquecido quando o app fecha.
 */
export class SqliteAppStateRepository implements AppStateRepository {
  constructor(private db: SqliteDatabaseDriver) {}

  async get(key: string): Promise<string | null> {
    const row = await this.db.getFirstAsync<AppStateRow>(
      `SELECT * FROM app_state WHERE key = ?`,
      [key]
    );
    if (!row) return null;
    return row.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, value, new Date().toISOString()]
    );
  }
}
