import type { SqliteDatabaseDriver } from '../DatabaseDriver';
import { INITIAL_SCHEMA_SQL } from './schema.sql';

/**
 * Versão atual do schema local.
 *
 * A migração 001 é o schema inicial da Fase 2. Ela usa `IF NOT EXISTS` para
 * também ser segura em bancos criados antes do controle de versão existir.
 */
export const LATEST_SCHEMA_VERSION = 3;

interface UserVersionRow {
  user_version: number;
}

interface Migration {
  version: number;
  up: (db: SqliteDatabaseDriver) => Promise<void>;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: async (db) => {
      await db.execAsync(INITIAL_SCHEMA_SQL);
    },
  },
  {
    // Perfil editável do usuário: descrição, foto (caminho local) e interesses (JSON).
    version: 2,
    up: async (db) => {
      await db.execAsync(
        `ALTER TABLE users ADD COLUMN bio TEXT;
         ALTER TABLE users ADD COLUMN avatar_uri TEXT;
         ALTER TABLE users ADD COLUMN interests TEXT;`
      );
    },
  },
  {
    // Pull incremental (OFF-06, ordem 6): cursor (updated_at, id) do servidor.
    // Banco existente começa sem cursor → a 1ª sincronização baixa tudo.
    version: 3,
    up: async (db) => {
      // Defensivo: bancos parciais (sem `sync_state`) ganham a tabela já com
      // a coluna; os demais só recebem a coluna se ainda não a tiverem.
      await db.execAsync(
        `CREATE TABLE IF NOT EXISTS sync_state (
           key TEXT PRIMARY KEY NOT NULL,
           last_sync_at TEXT,
           last_success_at TEXT,
           cursor TEXT
         );`
      );
      const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(sync_state)');
      if (!cols.some((c) => c.name === 'cursor')) {
        await db.execAsync(`ALTER TABLE sync_state ADD COLUMN cursor TEXT;`);
      }
    },
  },
];

export async function getSchemaVersion(db: SqliteDatabaseDriver): Promise<number> {
  const row = await db.getFirstAsync<UserVersionRow>('PRAGMA user_version');
  return Number(row?.user_version ?? 0);
}

/**
 * Aplica as migrações pendentes de forma idempotente.
 *
 * Bancos novos começam em `user_version = 0`; bancos legados (criados apenas
 * com `INITIAL_SCHEMA_SQL`) também. Como a 001 usa `IF NOT EXISTS`, reaplicá-la
 * é seguro e cria apenas índices/tabelas ausentes.
 */
export async function applyMigrations(db: SqliteDatabaseDriver): Promise<void> {
  const currentVersion = await getSchemaVersion(db);
  if (currentVersion >= LATEST_SCHEMA_VERSION) return;

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) continue;

    await db.withTransactionAsync(async () => {
      await migration.up(db);
    });
    // `user_version` é transacional no SQLite, mas deixamos a atualização
    // fora do callback para também funcionar em drivers de teste simples.
    await db.execAsync(`PRAGMA user_version = ${migration.version}`);
  }
}
