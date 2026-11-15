import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { FavoriteRepository } from '../../domain/ports/FavoriteRepository';
import { AdoptionInterestRepository } from '../../domain/ports/AdoptionInterestRepository';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { PhotoStorage } from '../../domain/ports/PhotoStorage';
import { CameraGateway } from '../../domain/ports/CameraGateway';
import { LocationGateway } from '../../domain/ports/LocationGateway';
import { UserRepository } from '../../domain/ports/UserRepository';
import { SearchPreferencesRepository } from '../../domain/ports/SearchPreferencesRepository';
import { SyncMetadataRepository } from '../../domain/ports/SyncMetadataRepository';
import { AppStateRepository } from '../../domain/ports/AppStateRepository';
import { UnitOfWork } from '../../application/ports/UnitOfWork';
import { RemoteAnimalSource } from '../../domain/ports/RemoteAnimalSource';
import { FavoriteRemoteGateway } from '../../domain/ports/FavoriteRemoteGateway';
import { InterestRemoteGateway } from '../../domain/ports/InterestRemoteGateway';
import { AuthGateway } from '../../domain/ports/AuthGateway';
import { ModerationGateway } from '../../domain/ports/ModerationGateway';
import { ImageProcessor } from '../../domain/ports/ImageProcessor';
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
import { SqliteAppStateRepository } from '../database/sqlite/repositories/SqliteAppStateRepository';
import { WebpPhotoStorage } from '../../application/photos/WebpPhotoStorage';
import { ExpoImageManipulatorAdapter } from '../device/image/ExpoImageManipulatorAdapter';
import { ImagePickerCameraAdapter } from '../device/camera/ImagePickerCameraAdapter';
import { ExpoLocationAdapter } from '../device/location/LocationAdapter';
import { loadSupabaseClient } from '../supabase/client';
import { SupabaseClientLike, SupabaseConfig, SupabaseModuleLike } from '../supabase/types';
import { SupabaseAnimalRepository } from '../supabase/repositories/SupabaseAnimalRepository';
import { SupabaseAuthGateway } from '../supabase/auth/SupabaseAuthGateway';
import { SupabaseModerationRepository } from '../supabase/repositories/SupabaseModerationRepository';
import {
  SupabaseFavoriteGateway,
  SupabaseInterestGateway,
} from '../supabase/repositories/SupabaseUserDataGateways';
import { SupabasePhotoStorage, FileReader } from '../supabase/storage/SupabasePhotoStorage';
import { buildSeedAnimals } from '../../adapters/demo/seedAnimals';

export type AppMode = 'sqlite' | 'memory' | 'demo';
export type RemoteMode = 'none' | 'supabase';

export interface AppContainer {
  mode: AppMode;
  remoteMode: RemoteMode;
  animalRepository: AnimalRepository;
  favoriteRepository: FavoriteRepository;
  interestRepository: AdoptionInterestRepository;
  syncQueueRepository: SyncQueueRepository;
  photoStorage: PhotoStorage;
  remotePhotoStorage?: PhotoStorage;
  remoteAnimalSource?: RemoteAnimalSource;
  remoteFavorites?: FavoriteRemoteGateway;
  remoteInterests?: InterestRemoteGateway;
  userRepository: UserRepository;
  searchPreferencesRepository: SearchPreferencesRepository;
  syncMetadataRepository: SyncMetadataRepository;
  appStateRepository: AppStateRepository;
  unitOfWork: UnitOfWork;
  cameraGateway: CameraGateway;
  locationGateway: LocationGateway;
  authGateway?: AuthGateway;
  moderationGateway?: ModerationGateway;
}

export interface AppContainerOptions {
  driver?: SqliteDatabaseDriver;
  supabaseClient?: SupabaseClientLike | null;
  supabaseModule?: SupabaseModuleLike | null;
  supabaseConfig?: SupabaseConfig | null;
  imageProcessor?: ImageProcessor;
  readFile?: FileReader;
}

/**
 * Ponto único de composição do aplicativo Enlace.
 * Monta os repositórios locais SQLite e os gateways remotos do Supabase.
 */
export async function loadAppContainer(
  driverOrOptions?: SqliteDatabaseDriver | AppContainerOptions
): Promise<AppContainer> {
  const options: AppContainerOptions =
    driverOrOptions && 'execAsync' in driverOrOptions
      ? { driver: driverOrOptions }
      : (driverOrOptions ?? {});

  const db = options.driver ?? (await getDatabaseDriver());
  await applyMigrations(db);

  const supabaseClient =
    'supabaseClient' in options
      ? options.supabaseClient ?? null
      : loadSupabaseClient({
          ...(options.supabaseModule !== undefined
            ? { supabaseModule: options.supabaseModule }
            : {}),
          ...(options.supabaseConfig !== undefined
            ? { config: options.supabaseConfig }
            : {}),
        });

  const animalRepository = new SqliteAnimalRepository(db);
  const favoriteRepository = new SqliteFavoriteRepository(db);
  const interestRepository = new SqliteAdoptionInterestRepository(db);
  const syncQueueRepository = new SqliteSyncQueueRepository(db);
  const sqlitePhotoStorage = new SqlitePhotoStorage(db);
  const imageProcessor = options.imageProcessor ?? new ExpoImageManipulatorAdapter();
  const photoStorage = new WebpPhotoStorage(sqlitePhotoStorage, imageProcessor);

  const remotePhotoStorage = supabaseClient
    ? new SupabasePhotoStorage({
        local: photoStorage,
        client: supabaseClient,
        readFile: options.readFile,
      })
    : undefined;

  const supabaseAnimals = supabaseClient ? new SupabaseAnimalRepository(supabaseClient) : undefined;
  const remoteAnimalSource: RemoteAnimalSource | undefined = supabaseAnimals;
  const remoteFavorites = supabaseClient
    ? new SupabaseFavoriteGateway(supabaseClient)
    : undefined;
  const remoteInterests = supabaseClient
    ? new SupabaseInterestGateway(supabaseClient)
    : undefined;
  const authGateway = supabaseClient ? new SupabaseAuthGateway(supabaseClient) : undefined;
  const moderationGateway = supabaseClient
    ? new SupabaseModerationRepository(supabaseClient)
    : undefined;

  const userRepository = new SqliteUserRepository(db);
  const searchPreferencesRepository = new SqliteSearchPreferencesRepository(db);
  const syncMetadataRepository = new SqliteSyncMetadataRepository(db);
  const appStateRepository = new SqliteAppStateRepository(db);
  const unitOfWork = new SqliteUnitOfWork(db);
  const cameraGateway = new ImagePickerCameraAdapter();
  const locationGateway = new ExpoLocationAdapter();

  const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
  if (supabaseClient && remoteAnimalSource && !isTestEnv) {
    const existing = await animalRepository.search({});
    if (existing.length === 0) {
      try {
        const page = await remoteAnimalSource.listVisibleChangedAfter(null, 50);
        if (page.animals.length > 0) {
          await animalRepository.upsertCache(page.animals);
        } else {
          await seedCacheIfEmpty(animalRepository);
        }
      } catch {
        await seedCacheIfEmpty(animalRepository);
      }
    }
  } else {
    await seedCacheIfEmpty(animalRepository);
  }

  return {
    mode: db.mode,
    remoteMode: supabaseClient ? 'supabase' : 'none',
    animalRepository,
    favoriteRepository,
    interestRepository,
    syncQueueRepository,
    photoStorage,
    remotePhotoStorage,
    remoteAnimalSource,
    remoteFavorites,
    remoteInterests,
    userRepository,
    searchPreferencesRepository,
    syncMetadataRepository,
    appStateRepository,
    unitOfWork,
    cameraGateway,
    locationGateway,
    authGateway,
    moderationGateway,
  };
}

export async function seedCacheIfEmpty(animalRepository: AnimalRepository): Promise<void> {
  const existing = await animalRepository.search({});
  if (existing.length > 0) return;
  await animalRepository.upsertCache(buildSeedAnimals());
}
