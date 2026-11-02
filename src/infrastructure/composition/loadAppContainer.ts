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
import { UnitOfWork } from '../../application/ports/UnitOfWork';
import { getDatabaseDriver, SqliteDatabaseDriver } from '../database/sqlite/DatabaseDriver';
import { applyMigrations } from '../database/sqlite/migrations';
import { SqliteUnitOfWork } from '../database/sqlite/SqliteUnitOfWork';
import { SqliteAnimalRepository } from '../database/sqlite/repositories/SqliteAnimalRepository';
import { SqliteFavoriteRepository } from '../database/sqlite/repositories/SqliteFavoriteRepository';
import { SqliteAdoptionInterestRepository } from '../database/sqlite/repositories/SqliteAdoptionInterestRepository';
import { SqliteSyncQueueRepository } from '../database/sqlite/repositories/SqliteSyncQueueRepository';
import { ImageProcessor } from '../../domain/ports/ImageProcessor';
import { WebpPhotoStorage } from '../../application/photos/WebpPhotoStorage';
import { ExpoImageManipulatorAdapter } from '../device/image/ExpoImageManipulatorAdapter';
import { RemoteAnimalSource } from '../../domain/ports/RemoteAnimalSource';
import { FavoriteRemoteGateway } from '../../domain/ports/FavoriteRemoteGateway';
import { InterestRemoteGateway } from '../../domain/ports/InterestRemoteGateway';
import { SupabaseFavoriteGateway, SupabaseInterestGateway } from '../supabase/repositories/SupabaseUserDataGateways';
import { SupabasePhotoStorage, FileReader } from '../supabase/storage/SupabasePhotoStorage';
import { SqlitePhotoStorage } from '../database/sqlite/repositories/SqlitePhotoStorage';
import { SqliteUserRepository } from '../database/sqlite/repositories/SqliteUserRepository';
import { SqliteSearchPreferencesRepository } from '../database/sqlite/repositories/SqliteSearchPreferencesRepository';
import { SqliteSyncMetadataRepository } from '../database/sqlite/repositories/SqliteSyncMetadataRepository';
import { ImagePickerCameraAdapter } from '../device/camera/ImagePickerCameraAdapter';
import { ExpoLocationAdapter } from '../device/location/LocationAdapter';
import { loadSupabaseClient } from '../supabase/client';
import { SupabaseClientLike, SupabaseConfig, SupabaseModuleLike } from '../supabase/types';
import { SupabaseAnimalRepository } from '../supabase/repositories/SupabaseAnimalRepository';
import { SupabaseAuthGateway } from '../supabase/auth/SupabaseAuthGateway';
import { SupabaseModerationRepository } from '../supabase/repositories/SupabaseModerationRepository';
import { AuthGateway } from '../../domain/ports/AuthGateway';
import { ModerationGateway } from '../../domain/ports/ModerationGateway';
import { buildSeedAnimals } from '../../adapters/demo/seedAnimals';

export type AppMode = 'sqlite' | 'memory' | 'demo';
export type RemoteMode = 'none' | 'supabase';

export interface AppContainer {
  mode: AppMode;
  /** Backend remoto em uso: `none` = 100% local (modo honesto); `supabase` = ligado. */
  remoteMode: RemoteMode;
  animalRepository: AnimalRepository;
  favoriteRepository: FavoriteRepository;
  interestRepository: AdoptionInterestRepository;
  syncQueueRepository: SyncQueueRepository;
  photoStorage: PhotoStorage;
  /** Upload ao Supabase Storage; só existe com backend configurado (Passo 4). */
  remotePhotoStorage?: PhotoStorage;
  /** Pernas remotas da sincronização — só existem com backend configurado. */
  remoteAnimalSource?: RemoteAnimalSource;
  remoteFavorites?: FavoriteRemoteGateway;
  remoteInterests?: InterestRemoteGateway;
  userRepository: UserRepository;
  searchPreferencesRepository: SearchPreferencesRepository;
  syncMetadataRepository: SyncMetadataRepository;
  unitOfWork: UnitOfWork;
  /** Gateways de hardware (passo da geolocalização/fotos real). */
  cameraGateway: CameraGateway;
  locationGateway: LocationGateway;
  /** Presentes apenas quando o Supabase está configurado (Fase 3). */
  authGateway?: AuthGateway;
  moderationGateway?: ModerationGateway;
}

export interface AppContainerOptions {
  /** Driver injetado (testes/contratos). Padrão: driver Expo SQLite real. */
  driver?: SqliteDatabaseDriver;
  /** Cliente Supabase inteiro injetado (testes). `null` força `remoteMode: 'none'`. */
  supabaseClient?: SupabaseClientLike | null;
  /** Módulo SDK injetado (testes), quando não é desejado exigir o pacote. */
  supabaseModule?: SupabaseModuleLike | null;
  /** Config explícita (testes) — alternativa a `EXPO_PUBLIC_*`. */
  supabaseConfig?: SupabaseConfig | null;
  /** Conversor de imagens injetado (testes). Padrão: expo-image-manipulator (WebP). */
  imageProcessor?: ImageProcessor;
  /** Leitor de arquivos para o upload (testes). Padrão: expo-file-system. */
  readFile?: FileReader;
}

/**
 * Ponto de composição do app em runtime (Fase 2 — Persistência local real;
 * Fase 3 — Supabase opcional, ligado por configuração, nunca obrigatório).
 *
 * Monta os repositórios SQLite sobre o driver de banco e popula o cache
 * inicial de anúncios na primeira execução. Em produção, uma falha ao abrir
 * o SQLite não é mascarada por um banco em memória: o erro chega ao provider.
 *
 * Regra §0.1: **sem credenciais do Supabase o app segue 100% offline/SQLite**
 * (remoteMode 'none'). Com credenciais, os mesmos ports ganham a perna remota
 * (decorador SupabaseAnimalRepository) e auth/moderação reais — o build
 * do APK e o funcionamento sem rede não são afetados.
 */
export async function loadAppContainer(
  driver?: SqliteDatabaseDriver,
  options: AppContainerOptions = {}
): Promise<AppContainer> {
  const db = driver || (options.driver ?? (await getDatabaseDriver()));

  // O container garante o schema mesmo quando recebe um driver já aberto
  // (testes/contratos). Em produção a chamada é idempotente.
  await applyMigrations(db);

  const supabaseClient: SupabaseClientLike | null =
    'supabaseClient' in options
      ? options.supabaseClient || null
      : loadSupabaseClient({
          supabaseModule: 'supabaseModule' in options ? options.supabaseModule : undefined,
          config: 'supabaseConfig' in options ? options.supabaseConfig : undefined,
        });

  let animalRepository: AnimalRepository = new SqliteAnimalRepository(db);
  const favoriteRepository = new SqliteFavoriteRepository(db);
  const interestRepository = new SqliteAdoptionInterestRepository(db);
  const syncQueueRepository = new SqliteSyncQueueRepository(db);
  // Conversão para WebP obrigatória em toda foto guardada (local e remota).
  let photoStorage: PhotoStorage = new WebpPhotoStorage(
    new SqlitePhotoStorage(db),
    options.imageProcessor ?? new ExpoImageManipulatorAdapter()
  );
  let remotePhotoStorage: PhotoStorage | undefined;
  let remoteAnimalSource: RemoteAnimalSource | undefined;
  let remoteFavorites: FavoriteRemoteGateway | undefined;
  let remoteInterests: InterestRemoteGateway | undefined;
  const userRepository = new SqliteUserRepository(db);
  const searchPreferencesRepository = new SqliteSearchPreferencesRepository(db);
  const syncMetadataRepository = new SqliteSyncMetadataRepository(db);
  const unitOfWork = new SqliteUnitOfWork(db);

  let authGateway: AuthGateway | undefined;
  let moderationGateway: ModerationGateway | undefined;
  if (supabaseClient) {
    // Fotos primeiro: o repositório remoto precisa do upload para subir as imagens
    // antes de gravar o anúncio, também no caminho online (doc §14.1).
    photoStorage = new SupabasePhotoStorage({
      local: photoStorage,
      client: supabaseClient,
      readFile: options.readFile,
    });
    remotePhotoStorage = photoStorage;
    const supabaseAnimals = new SupabaseAnimalRepository({
      local: animalRepository,
      client: supabaseClient,
      photoUploader: photoStorage,
    });
    animalRepository = supabaseAnimals;
    remoteAnimalSource = supabaseAnimals;
    remoteFavorites = new SupabaseFavoriteGateway(supabaseClient);
    remoteInterests = new SupabaseInterestGateway(supabaseClient);
    authGateway = new SupabaseAuthGateway({ client: supabaseClient });
    moderationGateway = new SupabaseModerationRepository({ client: supabaseClient });
  }

  // Gateways de hardware reais: os módulos expo-image-picker/expo-location
  // são carregados dinamicamente pelos adapters — em Jest/demo operam sem a
  // ponte nativa, com degradação definida (câmera → null; GPS → erro
  // tipado tratado pela UI).
  const cameraGateway = new ImagePickerCameraAdapter();
  const locationGateway = new ExpoLocationAdapter();

  await seedCacheIfEmpty(animalRepository);

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
    unitOfWork,
    cameraGateway,
    locationGateway,
    authGateway,
    moderationGateway,
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
