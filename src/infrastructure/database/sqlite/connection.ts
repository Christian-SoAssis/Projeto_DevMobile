import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';
import { applyMigrations, type MigrationExecutor } from './migrations';

export const LOCAL_DATABASE_NAME = 'enlace.db';

// Tipo único do app (driver expo). Nos testes Jest, o drizzle sobre
// better-sqlite3 é injetado com cast para este tipo: a API do query builder
// usada pelos repositórios (select/insert/update/delete + await) é idêntica
// nos dois drivers, e `await` normaliza sync/async.
export type AppDatabase = ExpoSQLiteDatabase<typeof schema>;

export type TransactionRunner = <T>(fn: (txDb: AppDatabase) => Promise<T>) => Promise<T>;

export interface LocalDatabase {
  db: AppDatabase;
  rawDb: SQLiteDatabase;
  withTransaction: TransactionRunner;
  close(): void;
}

function expoExecutor(rawDb: SQLiteDatabase): MigrationExecutor {
  return {
    run: (sql: string) => rawDb.execAsync(sql),
    all: <T>(sql: string) => rawDb.getAllAsync<T>(sql),
  };
}

export async function openLocalDatabase(name: string = LOCAL_DATABASE_NAME): Promise<LocalDatabase> {
  const rawDb = openDatabaseSync(name);
  await applyMigrations(expoExecutor(rawDb));
  const db = drizzle(rawDb, { schema });
  return {
    db,
    rawDb,
    withTransaction: async <T>(fn: (txDb: AppDatabase) => Promise<T>): Promise<T> => {
      const box: { value?: T } = {};
      await rawDb.withTransactionAsync(async () => {
        box.value = await fn(db);
      });
      return box.value as T;
    },
    close: () => rawDb.closeSync(),
  };
}
