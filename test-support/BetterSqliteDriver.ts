import Database from 'better-sqlite3';
import type {
  SqliteDatabaseDriver,
  SqliteRunResult,
} from '../src/infrastructure/database/sqlite/DatabaseDriver';

/**
 * Driver SQLite real para testes de contrato.
 *
 * Usa o mesmo contrato (`SqliteDatabaseDriver`) consumido pelo app, mas abre
 * um banco SQLite de verdade via `better-sqlite3`. Fica fora de `src/` porque
 * é infraestrutura de teste, não código de produção. Os testes que o usam
 * declaram `@jest-environment node` para carregar o binding nativo.
 */
export class BetterSqliteDriver implements SqliteDatabaseDriver {
  readonly mode = 'sqlite' as const;
  private transactionDepth = 0;

  constructor(readonly db: Database.Database = new Database(':memory:')) {
    this.db.pragma('foreign_keys = ON');
  }

  async execAsync(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<SqliteRunResult> {
    const result = this.db.prepare(sql).run(...params);
    return {
      changes: result.changes,
      lastInsertRowId: Number(result.lastInsertRowid),
    };
  }

  async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const row = this.db.prepare(sql).get(...params) as T | undefined;
    return row ?? null;
  }

  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...params) as T[];
  }

  async withTransactionAsync<T>(action: () => Promise<T>): Promise<T> {
    if (this.transactionDepth > 0) {
      return action();
    }

    this.transactionDepth += 1;
    let transactionStarted = false;
    try {
      this.db.exec('BEGIN');
      transactionStarted = true;
      const result = await action();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      if (transactionStarted) {
        try {
          this.db.exec('ROLLBACK');
        } catch {
          // Mantém o erro original; a transação já pode ter sido encerrada.
        }
      }
      throw error;
    } finally {
      this.transactionDepth -= 1;
    }
  }

  close(): void {
    this.db.close();
  }
}
