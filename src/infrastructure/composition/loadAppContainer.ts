import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { FavoriteRepository } from '../../domain/ports/FavoriteRepository';
import { AdoptionInterestRepository } from '../../domain/ports/AdoptionInterestRepository';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { PhotoStorage } from '../../domain/ports/PhotoStorage';
import { getDatabaseDriver, SqliteDatabaseDriver } from '../database/sqlite/DatabaseDriver';
import { SqliteAnimalRepository } from '../database/sqlite/repositories/SqliteAnimalRepository';
import { SqliteFavoriteRepository } from '../database/sqlite/repositories/SqliteFavoriteRepository';
import { SqliteAdoptionInterestRepository } from '../database/sqlite/repositories/SqliteAdoptionInterestRepository';
import { SqliteSyncQueueRepository } from '../database/sqlite/repositories/SqliteSyncQueueRepository';
import { SqlitePhotoStorage } from '../database/sqlite/repositories/SqlitePhotoStorage';
import { buildSeedAnimals } from '../../adapters/demo/seedAnimals';

export type AppMode = 'sqlite' | 'demo';

export interface AppContainer {
  mode: AppMode;
  animalRepository: AnimalRepository;
  favoriteRepository: FavoriteRepository;
  interestRepository: AdoptionInterestRepository;
  syncQueueRepository: SyncQueueRepository;
  photoStorage: PhotoStorage;
}

/**
 * Ponto de composição do app em runtime (Fase 2 — Persistência local real).
 *
 * Monta os repositórios SQLite sobre o driver de banco e popula o cache
 * inicial de anúncios na primeira execução. O driver (`getDatabaseDriver`)
 * já embute fallback em memória quando `expo-sqlite` não está disponível
 * (testes/demo), portanto em condições normais não lança erro.
 *
 * Regras respeitadas (doc §13.1): a UI recebe apenas os ports; nenhum
 * componente visual importa SQLite diretamente; o domínio continua puro.
 */
export async function loadAppContainer(driver?: SqliteDatabaseDriver): Promise<AppContainer> {
  const db = driver || (await getDatabaseDriver());

  const animalRepository = new SqliteAnimalRepository(db);
  const favoriteRepository = new SqliteFavoriteRepository(db);
  const interestRepository = new SqliteAdoptionInterestRepository(db);
  const syncQueueRepository = new SqliteSyncQueueRepository(db);
  const photoStorage = new SqlitePhotoStorage(db);

  await seedCacheIfEmpty(animalRepository);

  return {
    mode: 'sqlite',
    animalRepository,
    favoriteRepository,
    interestRepository,
    syncQueueRepository,
    photoStorage,
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
