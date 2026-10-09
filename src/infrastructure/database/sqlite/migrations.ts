import { INITIAL_SCHEMA_DOWN, INITIAL_SCHEMA_UP } from './migrations/001_initial';

export { INITIAL_SCHEMA_DOWN, INITIAL_SCHEMA_UP };

export interface Migration {
  version: number;
  name: string;
  up: string;
  down: string;
}

export const MIGRATIONS: Migration[] = [
  { version: 1, name: 'initial_schema', up: INITIAL_SCHEMA_UP, down: INITIAL_SCHEMA_DOWN },
];

export interface MigrationExecutor {
  run(sql: string): void | Promise<void>;
  all<T = Record<string, unknown>>(sql: string): T[] | Promise<T[]>;
}

const MIGRATIONS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS _migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);`;

export async function appliedVersions(executor: MigrationExecutor): Promise<number[]> {
  await executor.run(MIGRATIONS_TABLE_SQL);
  const rows = await executor.all<{ version: number }>('SELECT version FROM _migrations ORDER BY version ASC;');
  return rows.map((r) => r.version);
}

export async function applyMigrations(executor: MigrationExecutor): Promise<number[]> {
  const applied = new Set(await appliedVersions(executor));
  const newlyApplied: number[] = [];
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    await executor.run(migration.up);
    await executor.run(
      `INSERT INTO _migrations (version, name, applied_at) VALUES (${migration.version}, '${migration.name}', '${new Date().toISOString()}');`
    );
    newlyApplied.push(migration.version);
  }
  return newlyApplied;
}

export async function rollbackMigration(
  executor: MigrationExecutor,
  version: number
): Promise<void> {
  const migration = MIGRATIONS.find((m) => m.version === version);
  if (!migration) throw new Error(`Migration desconhecida: ${version}.`);
  await executor.run(migration.down);
  await executor.run(`DELETE FROM _migrations WHERE version = ${version};`);
}
