export interface SqliteDatabaseDriver {
  readonly mode: 'sqlite' | 'memory';
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  getFirstAsync<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>;
  getAllAsync<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  withTransactionAsync<T>(task: () => Promise<T>): Promise<T>;
}

/**
 * Driver em memória compatível com os repositórios SQLite do projeto.
 * Usado em testes automatizados (Jest) e como fallback seguro se `expo-sqlite`
 * falhar ao abrir no Expo Go — sem derrubar a integração com o Supabase.
 */
export class InMemorySqliteDriver implements SqliteDatabaseDriver {
  public readonly mode = 'memory' as const;
  private tables: Map<string, Array<Record<string, unknown>>> = new Map();

  constructor() {
    this.initTables();
  }

  private initTables(): void {
    const names = [
      'animals',
      'animal_photos',
      'local_images',
      'favorites',
      'adoption_interests',
      'sync_queue',
      'sync_metadata',
      'search_preferences',
      'app_state',
      'users',
    ];
    for (const name of names) {
      if (!this.tables.has(name)) {
        this.tables.set(name, []);
      }
    }
  }

  async execAsync(_sql: string): Promise<void> {
    this.initTables();
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
    const normalized = sql.replace(/\s+/g, ' ').trim();

    // INSERT OR REPLACE / INSERT INTO
    const insertMatch = /^INSERT\s+(?:OR\s+REPLACE\s+)?INTO\s+([a-z_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i.exec(
      normalized
    );
    if (insertMatch) {
      const table = insertMatch[1].toLowerCase();
      const cols = insertMatch[2].split(',').map((c) => c.trim());
      const rows = this.getTable(table);
      const record: Record<string, unknown> = {};
      cols.forEach((col, idx) => {
        record[col] = params[idx] ?? null;
      });
      this.upsertRecord(table, rows, record);
      return { changes: 1 };
    }

    // UPDATE table SET col1 = ?, col2 = ? WHERE ...
    const updateMatch = /^UPDATE\s+([a-z_]+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i.exec(normalized);
    if (updateMatch) {
      const table = updateMatch[1].toLowerCase();
      const setClause = updateMatch[2];
      const whereClause = updateMatch[3] ?? '';
      const setCols = setClause.split(',').map((part) => part.split('=')[0].trim());
      const setValues = params.slice(0, setCols.length);
      const whereParams = params.slice(setCols.length);
      const rows = this.getTable(table);
      const matched = this.filterRows(rows, whereClause, whereParams);
      for (const row of matched) {
        setCols.forEach((col, idx) => {
          row[col] = setValues[idx];
        });
      }
      return { changes: matched.length };
    }

    // DELETE FROM table WHERE ...
    const deleteMatch = /^DELETE\s+FROM\s+([a-z_]+)(?:\s+WHERE\s+(.+))?$/i.exec(normalized);
    if (deleteMatch) {
      const table = deleteMatch[1].toLowerCase();
      const whereClause = deleteMatch[2] ?? '';
      const rows = this.getTable(table);
      if (!whereClause) {
        const count = rows.length;
        this.tables.set(table, []);
        return { changes: count };
      }
      const toRemove = new Set(this.filterRows(rows, whereClause, params));
      const remaining = rows.filter((r) => !toRemove.has(r));
      this.tables.set(table, remaining);
      return { changes: toRemove.size };
    }

    return { changes: 0 };
  }

  async getFirstAsync<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<T | null> {
    const all = await this.getAllAsync<T>(sql, params);
    return all[0] ?? null;
  }

  async getAllAsync<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<T[]> {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    const selectMatch = /^SELECT\s+.+?\s+FROM\s+([a-z_]+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+))?$/i.exec(
      normalized
    );
    if (!selectMatch) return [];
    const table = selectMatch[1].toLowerCase();
    const whereClause = selectMatch[2] ?? '';
    const rows = this.getTable(table);
    const filtered = this.filterRows(rows, whereClause, params);
    return filtered.map((r) => ({ ...r })) as unknown as T[];
  }

  async withTransactionAsync<T>(task: () => Promise<T>): Promise<T> {
    return task();
  }

  private getTable(name: string): Array<Record<string, unknown>> {
    if (!this.tables.has(name)) {
      this.tables.set(name, []);
    }
    return this.tables.get(name)!;
  }

  private upsertRecord(
    table: string,
    rows: Array<Record<string, unknown>>,
    record: Record<string, unknown>
  ): void {
    const pkMatch = (r: Record<string, unknown>): boolean => {
      if (table === 'favorites') {
        return r.user_id === record.user_id && r.animal_id === record.animal_id;
      }
      if (table === 'sync_metadata' || table === 'app_state') {
        return r.key === record.key;
      }
      if ('id' in record && record.id !== undefined) {
        return r.id === record.id;
      }
      return false;
    };

    const idx = rows.findIndex(pkMatch);
    if (idx >= 0) {
      rows[idx] = { ...rows[idx], ...record };
    } else {
      rows.push(record);
    }
  }

  private filterRows(
    rows: Array<Record<string, unknown>>,
    whereClause: string,
    params: unknown[]
  ): Array<Record<string, unknown>> {
    if (!whereClause.trim()) return [...rows];

    const conditions = whereClause.split(/\s+AND\s+/i).map((c) => c.trim());
    let paramIndex = 0;

    return rows.filter((row) => {
      let localParamIdx = paramIndex;
      for (const cond of conditions) {
        const eqMatch = /^([a-z_]+)\s*=\s*\?$/i.exec(cond);
        if (eqMatch) {
          const col = eqMatch[1];
          const val = params[localParamIdx++];
          if (row[col] !== val) return false;
        }
      }
      return true;
    });
  }
}

/**
 * Driver real sobre `expo-sqlite` com proteção para transações e consultas.
 */
export class ExpoSqliteDriver implements SqliteDatabaseDriver {
  public readonly mode = 'sqlite' as const;

  constructor(private rawDb: any) {}

  async execAsync(sql: string): Promise<void> {
    await this.rawDb.execAsync(sql);
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
    const res = await this.rawDb.runAsync(sql, params);
    return { changes: res?.changes ?? 0 };
  }

  async getFirstAsync<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<T | null> {
    const row = await this.rawDb.getFirstAsync(sql, params);
    return (row as T) ?? null;
  }

  async getAllAsync<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<T[]> {
    const rows = await this.rawDb.getAllAsync(sql, params);
    return (rows as T[]) ?? [];
  }

  async withTransactionAsync<T>(task: () => Promise<T>): Promise<T> {
    if (typeof this.rawDb.withTransactionAsync === 'function') {
      let result!: T;
      await this.rawDb.withTransactionAsync(async () => {
        result = await task();
      });
      return result;
    }
    return task();
  }
}

let cachedDriver: SqliteDatabaseDriver | null = null;

export async function getDatabaseDriver(): Promise<SqliteDatabaseDriver> {
  if (cachedDriver) return cachedDriver;

  const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
  if (isTestEnv) {
    cachedDriver = new InMemorySqliteDriver();
    return cachedDriver;
  }

  try {
    const ExpoSQLite = require('expo-sqlite');
    if (typeof ExpoSQLite?.openDatabaseAsync === 'function') {
      const rawDb = await ExpoSQLite.openDatabaseAsync('enlace_adocao.db');
      cachedDriver = new ExpoSqliteDriver(rawDb);
      return cachedDriver;
    }
  } catch {
    // Fallback seguro se a ponte nativa não estiver disponível (ex.: web/Expo Go restrito)
  }

  cachedDriver = new InMemorySqliteDriver();
  return cachedDriver;
}
