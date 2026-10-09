export const INITIAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS animals (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  species TEXT NOT NULL,
  size TEXT NOT NULL,
  approximate_age TEXT NOT NULL,
  sex TEXT NOT NULL,
  description TEXT,
  health_notes TEXT,
  special_care TEXT,
  status TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS animal_photos (
  id TEXT PRIMARY KEY NOT NULL,
  animal_id TEXT NOT NULL,
  local_path TEXT,
  remote_url TEXT,
  is_main INTEGER NOT NULL DEFAULT 0,
  upload_status TEXT NOT NULL DEFAULT 'SYNCED',
  created_at TEXT NOT NULL,
  FOREIGN KEY (animal_id) REFERENCES animals (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS favorites (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  animal_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, animal_id)
);

CREATE TABLE IF NOT EXISTS adoption_interests (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  animal_id TEXT NOT NULL,
  message TEXT,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TEXT NOT NULL,
  UNIQUE(user_id, animal_id)
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  user_type TEXT NOT NULL DEFAULT 'USER',
  created_at TEXT NOT NULL
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

CREATE TABLE IF NOT EXISTS local_images (
  id TEXT PRIMARY KEY NOT NULL,
  animal_local_or_remote_id TEXT NOT NULL,
  local_path TEXT NOT NULL,
  remote_url TEXT,
  upload_status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY NOT NULL,
  last_sync_at TEXT,
  last_success_at TEXT
);

CREATE TABLE IF NOT EXISTS search_preferences (
  user_id TEXT PRIMARY KEY NOT NULL,
  species TEXT,
  size TEXT,
  approximate_age TEXT,
  sex TEXT,
  search_query TEXT,
  radius_km REAL,
  updated_at TEXT NOT NULL
);
`;
