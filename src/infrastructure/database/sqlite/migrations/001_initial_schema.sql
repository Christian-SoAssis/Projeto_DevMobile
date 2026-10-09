-- Enlace — Fase 2 (SQLite local, offline-first)
-- DDL normativo. Fonte: documentacao-software-rede-adocao-animais.md §§4.2, 5, 5.1.
-- Cache (espelho do remoto): animals, animal_photos, favorites, adoption_interests, profiles.
-- Somente local: sync_queue, local_images, sync_state (_migrations é controle interno), search_preferences.
-- ApproximateLocation é VO embutido em animals (sem tabela própria, sem endereço exato).

CREATE TABLE IF NOT EXISTS animals (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  species TEXT NOT NULL,
  size TEXT NOT NULL,
  approximate_age TEXT NOT NULL,
  sex TEXT NOT NULL,
  characteristics TEXT NOT NULL DEFAULT '',
  behavior TEXT NOT NULL DEFAULT '',
  special_care TEXT NOT NULL DEFAULT 'Nenhum',
  adoption_status TEXT NOT NULL DEFAULT 'AVAILABLE',
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  region TEXT NOT NULL,
  latitude_approx REAL NOT NULL,
  longitude_approx REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_animals_owner ON animals(owner_id);
CREATE INDEX IF NOT EXISTS idx_animals_status ON animals(adoption_status);
CREATE INDEX IF NOT EXISTS idx_animals_species ON animals(species);

CREATE TABLE IF NOT EXISTS animal_photos (
  id TEXT PRIMARY KEY,
  animal_id TEXT NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  storage_path TEXT,
  remote_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  CHECK (storage_path IS NOT NULL OR remote_url IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_photos_animal ON animal_photos(animal_id);

CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL,
  animal_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, animal_id)
);

CREATE TABLE IF NOT EXISTS adoption_interests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  animal_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_interests_user ON adoption_interests(user_id);
CREATE INDEX IF NOT EXISTS idx_interests_animal ON adoption_interests(animal_id);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'USER',
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  operation TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  changed_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING',
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_queue(status);

CREATE TABLE IF NOT EXISTS local_images (
  id TEXT PRIMARY KEY,
  animal_local_or_remote_id TEXT NOT NULL,
  local_path TEXT NOT NULL,
  remote_url TEXT,
  upload_status TEXT NOT NULL DEFAULT 'PENDING'
);
CREATE INDEX IF NOT EXISTS idx_local_images_animal ON local_images(animal_local_or_remote_id);

CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY,
  last_sync_at TEXT,
  last_success_at TEXT,
  version INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS search_preferences (
  user_id TEXT PRIMARY KEY,
  species TEXT,
  size TEXT,
  age TEXT,
  sex TEXT,
  distance REAL,
  region TEXT
);
