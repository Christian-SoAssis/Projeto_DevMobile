import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { FavoriteRepository } from '../../domain/ports/FavoriteRepository';
import { AdoptionInterestRepository } from '../../domain/ports/AdoptionInterestRepository';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { PhotoStorage } from '../../domain/ports/PhotoStorage';
import { UserRepository } from '../../domain/ports/UserRepository';
import { SearchPreferencesRepository } from '../../domain/ports/SearchPreferencesRepository';
import { SyncMetadataRepository } from '../../domain/ports/SyncMetadataRepository';
import { UnitOfWork } from '../../application/ports/UnitOfWork';
import { getDatabaseDriver, SqliteDatabaseDriver } from '../database/sqlite/DatabaseDriver';
import { applyMigrations } from '../database/sqlite/migrations';
import { SqliteUnitOfWork } from '../database/sqlite/SqliteUnitOfWork';
import { SqliteAnimalRepository } from '../database/sqlite/repositories/SqliteAnimalRepository';
import { SqliteFavoriteRepository } from '../database/sqlite/repositories/SqliteFavoriteRepository';
import { SqliteAdoptionInterestRepository } from '../database/sqlite/repositories/SqliteAdoptionInterestRepository';
import { SqliteSyncQueueRepository } from '../database/sqlite/repositories/SqliteSyncQueueRepository';
import { SqlitePhotoStorage } from '../database/sqlite/repositories/SqlitePhotoStorage';
import { SqliteUserRepository } from '../database/sqlite/repositories/SqliteUserRepository';
import { SqliteSearchPreferencesRepository } from '../database/sqlite/repositories/SqliteSearchPreferencesRepository';
import { SqliteSyncMetadataRepository } from '../database/sqlite/repositories/SqliteSyncMetadataRepository';
import { buildSeedAnimals } from '../../adapters/demo/seedAnimals';

export type AppMode = 'sqlite' | 'memory' | 'demo';

export interface AppContainer {
  mode: AppMode;
  animalRepository: AnimalRepository;
  favoriteRepository: FavoriteRepository;
  interestRepository: AdoptionInterestRepository;
  syncQueueRepository: SyncQueueRepository;
  photoStorage: PhotoStorage;
  userRepository: UserRepository;
  searchPreferencesRepository: SearchPreferencesRepository;
  syncMetadataRepository: SyncMetadataRepository;
  unitOfWork: UnitOfWork;
}

/**
 * Ponto de composição do app em runtime (Fase 2 — Persistência local real).
 *
 * Monta os repositórios SQLite sobre o driver de banco e popula o cache
 * inicial de anúncios na primeira execução. Em produção, uma falha ao abrir
 * o SQLite não é mascarada por um banco em memória: o erro chega ao provider.
 */
export async function loadAppContainer(driver?: SqliteDatabaseDriver): Promise<AppContainer> {
  const db = driver || (await getDatabaseDriver());

  // O container garante o schema mesmo quando recebe um driver já aberto
  // (testes/contratos). Em produção a chamada é idempotente.
  await applyMigrations(db);

  const animalRepository = new SqliteAnimalRepository(db);
  const favoriteRepository = new SqliteFavoriteRepository(db);
  const interestRepository = new SqliteAdoptionInterestRepository(db);
  const syncQueueRepository = new SqliteSyncQueueRepository(db);
  const photoStorage = new SqlitePhotoStorage(db);
  const userRepository = new SqliteUserRepository(db);
  const searchPreferencesRepository = new SqliteSearchPreferencesRepository(db);
  const syncMetadataRepository = new SqliteSyncMetadataRepository(db);
  const unitOfWork = new SqliteUnitOfWork(db);

  await seedCacheIfEmpty(animalRepository);

  return {
    mode: db.mode,
    animalRepository,
    favoriteRepository,
    interestRepository,
    syncQueueRepository,
    photoStorage,
    userRepository,
    searchPreferencesRepository,
    syncMetadataRepository,
    unitOfWork,
  };
}

/**
 * Popula o cache local de anúncios na primeira execução (RNF01: cache abre
 * sem depender da rede). Em execuções seguintes o SQLite real já contém os
 * dados — inclusive anúncios criados pelo usuário — e o seed é ignorado,
 * para nunca zerar dados locais.
 */
export async function seedCacheIfEmpty(animalRepository: AnimalRepository): Promise<void> {
  const existing = await animalRepository.search({});
  if (existing.length > 0) return;
  await animalRepository.upsertCache(buildSeedAnimals());
}
