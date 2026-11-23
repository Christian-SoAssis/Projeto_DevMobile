import { SqliteDatabaseDriver } from './DatabaseDriver';

/**
 * Registro de migrations aplicadas (DAT-01, OFF-02).
 * Permite evoluir o schema de forma sequenciada, preservando dados existentes.
 */
interface Migration {
  version: number;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    sql: `
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS animals (
      id TEXT PRIMARY KEY NOT NULL,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      species TEXT NOT NULL,
      size TEXT NOT NULL,
      approximate_age TEXT NOT NULL,
      sex TEXT NOT NULL,
      characteristics TEXT NOT NULL DEFAULT '',
      behavior TEXT NOT NULL DEFAULT '',
      special_care TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'AVAILABLE',
      neighborhood TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      region TEXT NOT NULL DEFAULT '',
      latitude REAL NOT NULL DEFAULT 0,
      longitude REAL NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS animal_photos (
      id TEXT PRIMARY KEY NOT NULL,
      animal_id TEXT NOT NULL,
      local_path TEXT,
      remote_url TEXT,
      upload_status TEXT NOT NULL DEFAULT 'PENDING',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_images (
      id TEXT PRIMARY KEY NOT NULL,
      animal_local_or_remote_id TEXT NOT NULL,
      local_path TEXT,
      remote_url TEXT,
      upload_status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS favorites (
      user_id TEXT NOT NULL,
      animal_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, animal_id)
    );

    CREATE TABLE IF NOT EXISTS adoption_interests (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT,
      user_email TEXT,
      animal_id TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      contact_info TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'ENVIADA',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY NOT NULL,
      operation TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      changed_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'PENDING',
      last_error TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY NOT NULL,
      last_sync_at TEXT NOT NULL,
      cursor_id TEXT,
      version INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS search_preferences (
      id TEXT PRIMARY KEY NOT NULL,
      species TEXT,
      size TEXT,
      approximate_age TEXT,
      sex TEXT,
      distance_km REAL,
      region TEXT
    );

    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      contact_info TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      avatar_url TEXT,
      interests_json TEXT NOT NULL DEFAULT '[]',
      role TEXT NOT NULL DEFAULT 'USER'
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      contact_info TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'USER',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
`,
  },
  {
    version: 2,
    sql: `
    CREATE INDEX IF NOT EXISTS idx_animals_updated_id ON animals (updated_at, id);
    CREATE INDEX IF NOT EXISTS idx_animals_owner_status ON animals (owner_id, status);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status_changed ON sync_queue (status, changed_at);
    CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites (user_id);
    CREATE INDEX IF NOT EXISTS idx_interests_animal ON adoption_interests (animal_id);
    CREATE INDEX IF NOT EXISTS idx_interests_user ON adoption_interests (user_id);
`,
  },
  {
    version: 3,
    sql: `
    UPDATE animal_photos
    SET local_path = NULL
    WHERE remote_url IS NOT NULL
      AND remote_url LIKE 'http%'
      AND id NOT IN (SELECT id FROM local_images);
`,
  },
];

/**
 * Inicialização e migrations idempotentes do schema SQLite local (DAT-01, OFF-02).
 * Preserva todos os dados existentes ao evoluir a estrutura.
 *
 * Como adicionar uma nova migration:
 * 1. Inserir um novo objeto no array `MIGRATIONS` com `version` incremental (ex.: 3, 4, ...)
 * 2. Usar apenas `ALTER TABLE ... ADD COLUMN` e `CREATE INDEX IF NOT EXISTS`
 *    — nunca `DROP TABLE` ou `ALTER TABLE ... DROP COLUMN`, para preservar dados
 * 3. O `applyMigrations` aplica apenas migrations cuja versão ainda não está
 *    registrada na tabela `schema_migrations`
 */
export async function applyMigrations(db: SqliteDatabaseDriver): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const appliedRows = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version'
  );
  const appliedVersions = new Set(appliedRows.map((r) => r.version));

  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) continue;

    await db.execAsync(migration.sql);

    await db.runAsync(
      'INSERT OR REPLACE INTO schema_migrations (version, applied_at) VALUES (?, datetime(\'now\'))',
      [migration.version]
    );
  }
}
