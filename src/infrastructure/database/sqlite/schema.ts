import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Mapeador ORM (drizzle-orm) do DDL normativo `migrations/001_initial_schema.sql`.
// Colunas/tabelas espelham o DDL; qualquer divergência é bug (coberta por teste).

export const animals = sqliteTable('animals', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  name: text('name').notNull(),
  species: text('species').notNull(),
  size: text('size').notNull(),
  approximateAge: text('approximate_age').notNull(),
  sex: text('sex').notNull(),
  characteristics: text('characteristics').notNull().default(''),
  behavior: text('behavior').notNull().default(''),
  specialCare: text('special_care').notNull().default('Nenhum'),
  adoptionStatus: text('adoption_status').notNull().default('AVAILABLE'),
  neighborhood: text('neighborhood').notNull(),
  city: text('city').notNull(),
  region: text('region').notNull(),
  latitudeApprox: real('latitude_approx').notNull(),
  longitudeApprox: real('longitude_approx').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  version: integer('version').notNull().default(1),
});

export const animalPhotos = sqliteTable('animal_photos', {
  id: text('id').primaryKey(),
  animalId: text('animal_id').notNull(),
  storagePath: text('storage_path'),
  remoteUrl: text('remote_url'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
});

export const favorites = sqliteTable('favorites', {
  userId: text('user_id').notNull(),
  animalId: text('animal_id').notNull(),
  createdAt: text('created_at').notNull(),
});

export const adoptionInterests = sqliteTable('adoption_interests', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  animalId: text('animal_id').notNull(),
  createdAt: text('created_at').notNull(),
});

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  role: text('role').notNull().default('USER'),
  createdAt: text('created_at').notNull(),
});

export const syncQueue = sqliteTable('sync_queue', {
  id: text('id').primaryKey(),
  operation: text('operation').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  payloadJson: text('payload_json').notNull().default('{}'),
  changedAt: text('changed_at').notNull(),
  attempts: integer('attempts').notNull().default(0),
  status: text('status').notNull().default('PENDING'),
  lastError: text('last_error'),
});

export const localImages = sqliteTable('local_images', {
  id: text('id').primaryKey(),
  animalLocalOrRemoteId: text('animal_local_or_remote_id').notNull(),
  localPath: text('local_path').notNull(),
  remoteUrl: text('remote_url'),
  uploadStatus: text('upload_status').notNull().default('PENDING'),
});

export const syncState = sqliteTable('sync_state', {
  key: text('key').primaryKey(),
  lastSyncAt: text('last_sync_at'),
  lastSuccessAt: text('last_success_at'),
  version: integer('version').notNull().default(0),
});

export const searchPreferences = sqliteTable('search_preferences', {
  userId: text('user_id').primaryKey(),
  species: text('species'),
  size: text('size'),
  age: text('age'),
  sex: text('sex'),
  distance: real('distance'),
  region: text('region'),
});

export type AnimalRow = typeof animals.$inferSelect;
export type AnimalPhotoRow = typeof animalPhotos.$inferSelect;
export type FavoriteRow = typeof favorites.$inferSelect;
export type AdoptionInterestRow = typeof adoptionInterests.$inferSelect;
export type ProfileRow = typeof profiles.$inferSelect;
export type SyncQueueRow = typeof syncQueue.$inferSelect;
export type SyncStateRow = typeof syncState.$inferSelect;
export type SearchPreferencesRow = typeof searchPreferences.$inferSelect;
