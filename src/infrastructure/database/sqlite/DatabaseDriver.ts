import { INITIAL_SCHEMA_SQL } from './migrations/schema.sql';

export interface SqliteRunResult {
  lastInsertRowId?: number;
  changes: number;
}

export interface SqliteDatabaseDriver {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: unknown[]): Promise<SqliteRunResult>;
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  withTransactionAsync<T>(action: () => Promise<T>): Promise<T>;
}

/**
 * In-memory SQLite driver for Jest tests and mock environments.
 */
export class InMemorySqliteDriver implements SqliteDatabaseDriver {
  private tables: Map<string, Map<string, Record<string, unknown>>> = new Map();

  constructor() {
    this.initTables();
  }

  private initTables(): void {
    const tableNames = [
      'animals',
      'animal_photos',
      'favorites',
      'adoption_interests',
      'users',
      'sync_queue',
      'local_images',
      'sync_state',
      'search_preferences',
    ];
    for (const table of tableNames) {
      this.tables.set(table, new Map());
    }
  }

  async execAsync(sql: string): Promise<void> {
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      if (stmt.toUpperCase().startsWith('CREATE TABLE')) {
        const tableNameMatch = stmt.match(/CREATE TABLE IF NOT EXISTS ([a-z0-9_]+)/i);
        if (tableNameMatch && tableNameMatch[1]) {
          const tableName = tableNameMatch[1].toLowerCase();
          if (!this.tables.has(tableName)) {
            this.tables.set(tableName, new Map());
          }
        }
      }
    }
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<SqliteRunResult> {
    const trimmed = sql.trim();
    const upper = trimmed.toUpperCase();

    if (upper.startsWith('INSERT INTO')) {
      return this.handleInsert(trimmed, params);
    } else if (upper.startsWith('UPDATE')) {
      return this.handleUpdate(trimmed, params);
    } else if (upper.startsWith('DELETE FROM')) {
      return this.handleDelete(trimmed, params);
    }

    return { changes: 0 };
  }

  async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const results = await this.getAllAsync<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const trimmed = sql.trim();
    const upper = trimmed.toUpperCase();
    const tableNameMatch = trimmed.match(/FROM\s+([a-z0-9_]+)/i);
    if (!tableNameMatch) return [];

    const tableName = tableNameMatch[1].toLowerCase();
    const tableMap = this.tables.get(tableName);
    if (!tableMap) return [];

    let rows = Array.from(tableMap.values());

    if (upper.includes('WHERE')) {
      rows = this.filterRows(trimmed, rows, params);
    }

    return rows as unknown as T[];
  }

  async withTransactionAsync<T>(action: () => Promise<T>): Promise<T> {
    return await action();
  }

  private handleInsert(sql: string, params: unknown[]): SqliteRunResult {
    const tableNameMatch = sql.match(/INSERT\s+INTO\s+([a-z0-9_]+)\s*\(([\s\S]+?)\)/i);
    if (!tableNameMatch) return { changes: 0 };

    const tableName = tableNameMatch[1].toLowerCase();
    const columns = tableNameMatch[2].split(',').map((c) => c.trim().toLowerCase());

    const tableMap = this.tables.get(tableName) || new Map();
    const record: Record<string, unknown> = {};

    columns.forEach((col, idx) => {
      record[col] = params[idx];
    });

    const primaryKey =
      (record.id as string) ||
      (record.key as string) ||
      (record.user_id && record.animal_id ? `${record.user_id}_${record.animal_id}` : undefined) ||
      (record.user_id as string) ||
      `${Date.now()}_${Math.random()}`;

    tableMap.set(primaryKey, record);
    this.tables.set(tableName, tableMap);

    return { changes: 1 };
  }

  private handleUpdate(sql: string, params: unknown[]): SqliteRunResult {
    const tableNameMatch = sql.match(/UPDATE\s+([a-z0-9_]+)\s+SET/i);
    if (!tableNameMatch) return { changes: 0 };

    const tableName = tableNameMatch[1].toLowerCase();
    const tableMap = this.tables.get(tableName);
    if (!tableMap) return { changes: 0 };

    const setMatch = sql.match(/SET\s+([\s\S]+?)\s+WHERE/i) || sql.match(/SET\s+([\s\S]+)/i);
    if (!setMatch) return { changes: 0 };

    const setClauses = setMatch[1].split(',').map((s) => s.trim());
    const whereParams = params.slice(setClauses.length);

    const rows = Array.from(tableMap.values());
    const matched = this.filterRows(sql, rows, whereParams);

    let changes = 0;
    for (const row of matched) {
      let paramIdx = 0;
      for (const clause of setClauses) {
        const [col] = clause.split('=').map((c) => c.trim().toLowerCase());
        row[col] = params[paramIdx++];
      }
      const pKey =
        (row.id as string) ||
        (row.key as string) ||
        (row.user_id && row.animal_id ? `${row.user_id}_${row.animal_id}` : undefined) ||
        (row.user_id as string);
      if (pKey) tableMap.set(pKey, row);
      changes++;
    }

    return { changes };
  }

  private handleDelete(sql: string, params: unknown[]): SqliteRunResult {
    const tableNameMatch = sql.match(/DELETE\s+FROM\s+([a-z0-9_]+)/i);
    if (!tableNameMatch) return { changes: 0 };

    const tableName = tableNameMatch[1].toLowerCase();
    const tableMap = this.tables.get(tableName);
    if (!tableMap) return { changes: 0 };

    if (!sql.toUpperCase().includes('WHERE')) {
      const count = tableMap.size;
      tableMap.clear();
      return { changes: count };
    }

    const rows = Array.from(tableMap.values());
    const matched = this.filterRows(sql, rows, params);

    let changes = 0;
    for (const row of matched) {
      const pKey =
        (row.id as string) ||
        (row.key as string) ||
        (row.user_id && row.animal_id ? `${row.user_id}_${row.animal_id}` : undefined) ||
        (row.user_id as string);
      if (pKey && tableMap.has(pKey)) {
        tableMap.delete(pKey);
        changes++;
      }
    }

    return { changes };
  }

  private filterRows(sql: string, rows: Record<string, unknown>[], params: unknown[]): Record<string, unknown>[] {
    const whereMatch = sql.match(/WHERE\s+([\s\S]+)$/i);
    if (!whereMatch) return rows;

    const clause = whereMatch[1].trim().toLowerCase();

    return rows.filter((row) => {
      if (clause === 'user_id = ? and animal_id = ?') {
        return row.user_id === params[0] && row.animal_id === params[1];
      }
      if (clause === 'id = ?') {
        return row.id === params[0];
      }
      if (clause === 'user_id = ?') {
        return row.user_id === params[0];
      }
      if (clause === 'animal_id = ?') {
        return row.animal_id === params[0];
      }
      if (clause === 'owner_id = ?') {
        return row.owner_id === params[0];
      }
      if (clause === 'email = ?') {
        return (row.email as string)?.toLowerCase() === (params[0] as string)?.toLowerCase();
      }
      if (clause === 'key = ?') {
        return row.key === params[0];
      }
      if (clause === 'status = ?') {
        return (row.status as string)?.toUpperCase() === (params[0] as string)?.toUpperCase();
      }
      if (clause === "status = 'completed'") {
        return (row.status as string)?.toUpperCase() === 'COMPLETED';
      }
      if (clause.includes("status = 'pending'") || clause.includes("status = 'failed'") || clause.includes("status = 'pending'")) {
        const s = (row.status as string)?.toUpperCase();
        return s === 'PENDING' || s === 'FAILED';
      }
      return true;
    });
  }
}

let driverInstance: SqliteDatabaseDriver | null = null;

export async function getDatabaseDriver(): Promise<SqliteDatabaseDriver> {
  if (!driverInstance) {
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
      const driver = new InMemorySqliteDriver();
      await driver.execAsync(INITIAL_SCHEMA_SQL);
      driverInstance = driver;
    } else {
      try {
        const SQLite = require('expo-sqlite');
        const db = await SQLite.openDatabaseAsync('enlace.db');
        await db.execAsync(INITIAL_SCHEMA_SQL);
        driverInstance = db;
      } catch {
        const driver = new InMemorySqliteDriver();
        await driver.execAsync(INITIAL_SCHEMA_SQL);
        driverInstance = driver;
      }
    }
  }
  return driverInstance!;
}

export function setTestDatabaseDriver(driver: SqliteDatabaseDriver): void {
  driverInstance = driver;
}
