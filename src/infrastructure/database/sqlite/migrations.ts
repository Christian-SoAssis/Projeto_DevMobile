import { SqliteDatabaseDriver } from './DatabaseDriver';

/**
 * Inicialização e migrations idempotentes do schema SQLite local (DAT-01, OFF-02).
 * Preserva todos os dados existentes ao evoluir a estrutura.
 */
export async function applyMigrations(db: SqliteDatabaseDriver): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

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
  `);
}
