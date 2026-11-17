import { Animal } from '../../domain/entities/Animal';
import { AnimalPhoto } from '../../domain/entities/AnimalPhoto';
import { Favorite } from '../../domain/entities/Favorite';
import { AdoptionInterest, InterestStage } from '../../domain/entities/AdoptionInterest';
import { SyncAction } from '../../domain/entities/SyncAction';
import { User } from '../../domain/entities/User';
import { SearchPreferences } from '../../domain/entities/SearchPreferences';
import { SyncMetadata } from '../../domain/entities/SyncMetadata';
import {
  AnimalRepository,
  AnimalSearchCriteria,
} from '../../domain/ports/AnimalRepository';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { FavoriteRepository } from '../../domain/ports/FavoriteRepository';
import { AdoptionInterestRepository } from '../../domain/ports/AdoptionInterestRepository';
import { UserRepository } from '../../domain/ports/UserRepository';
import { PhotoStorage } from '../../domain/ports/PhotoStorage';
import { AuthGateway, AuthSession, RegisterInput, UpdateProfileInput } from '../../domain/ports/AuthGateway';
import { LocationGateway } from '../../domain/ports/LocationGateway';
import { ConnectivityGateway } from '../../domain/ports/ConnectivityGateway';
import { RemoteAnimalSource, DeltaCursor, DeltaPage, TombstoneEntry, TombstonePage } from '../../domain/ports/RemoteAnimalSource';
import { FavoriteRemoteGateway } from '../../domain/ports/FavoriteRemoteGateway';
import { InterestRemoteGateway } from '../../domain/ports/InterestRemoteGateway';
import { ModerationGateway, ModerationAction } from '../../domain/ports/ModerationGateway';
import { AppStateRepository } from '../../domain/ports/AppStateRepository';
import { SearchPreferencesRepository } from '../../domain/ports/SearchPreferencesRepository';
import { SyncMetadataRepository } from '../../domain/ports/SyncMetadataRepository';
import { UnitOfWork } from '../../application/ports/UnitOfWork';
import { AdoptionStatus } from '../../domain/value-objects/AdoptionStatus';
import { AnimalCharacteristics } from '../../domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../domain/value-objects/ApproximateLocation';
import { generateUuid } from '../../domain/services/IdGenerator';

// ============================================================================
// FAKES IN-MEMORY PARA TESTES
// ============================================================================

export class InMemoryAnimalRepository implements AnimalRepository {
  private animals: Map<string, Animal> = new Map();

  async search(criteria?: AnimalSearchCriteria): Promise<Animal[]> {
    let results = Array.from(this.animals.values());

    if (criteria?.status) {
      const status = criteria.status as 'AVAILABLE' | 'ADOPTED';
      results = results.filter((a) =>
        status === 'AVAILABLE' ? a.status.isAvailable() : a.status.isAdopted()
      );
    }
    if (criteria?.query) {
      const q = criteria.query.toLowerCase();
      results = results.filter((a) => a.name.toLowerCase().includes(q));
    }
    if (criteria?.species) {
      results = results.filter((a) => a.characteristics.species === criteria.species);
    }
    if (criteria?.size) {
      results = results.filter((a) => a.characteristics.size === criteria.size);
    }
    if (criteria?.sex) {
      results = results.filter((a) => a.characteristics.sex === criteria.sex);
    }
    if (criteria?.approximateAge) {
      results = results.filter(
        (a) => a.characteristics.approximateAge === criteria.approximateAge
      );
    }
    if (criteria?.ownerId) {
      results = results.filter((a) => a.ownerId === criteria.ownerId);
    }
    if (criteria?.includeHidden !== true) {
      results = results.filter((a) => !a.hidden);
    }
    return results;
  }

  async findById(id: string): Promise<Animal | null> {
    return this.animals.get(id) ?? null;
  }

  async findByOwner(ownerId: string): Promise<Animal[]> {
    return Array.from(this.animals.values()).filter((a) => a.ownerId === ownerId);
  }

  async saveLocal(animal: Animal): Promise<void> {
    this.animals.set(animal.id, animal);
  }

  async upsertCache(animals: Animal[]): Promise<void> {
    for (const animal of animals) {
      this.animals.set(animal.id, animal);
    }
  }

  async deleteLocal(id: string): Promise<void> {
    this.animals.delete(id);
  }

  // Métodos auxiliares para testes
  get size(): number {
    return this.animals.size;
  }

  clear(): void {
    this.animals.clear();
  }

  setAnimal(animal: Animal): void {
    this.animals.set(animal.id, animal);
  }
}

export class InMemorySyncQueueRepository implements SyncQueueRepository {
  private actions: Map<string, SyncAction> = new Map();

  async enqueue(action: SyncAction): Promise<void> {
    this.actions.set(action.id, action);
  }

  async listPending(): Promise<SyncAction[]> {
    return Array.from(this.actions.values());
  }

  async findById(id: string): Promise<SyncAction | null> {
    return this.actions.get(id) ?? null;
  }

  async update(action: SyncAction): Promise<void> {
    this.actions.set(action.id, action);
  }

  async delete(id: string): Promise<void> {
    this.actions.delete(id);
  }

  // Métodos auxiliares para testes
  get size(): number {
    return this.actions.size;
  }

  clear(): void {
    this.actions.clear();
  }

  getPendingByEntityId(entityId: string): SyncAction[] {
    return Array.from(this.actions.values()).filter((a) => a.entityId === entityId);
  }

  getPendingByOperation(operation: string): SyncAction[] {
    return Array.from(this.actions.values()).filter((a) => a.operation === operation);
  }
}

export class InMemoryFavoriteRepository implements FavoriteRepository {
  private favorites: Map<string, Favorite> = new Map(); // key: userId:animalId

  async listByUser(userId: string): Promise<Favorite[]> {
    return Array.from(this.favorites.values()).filter((f) => f.userId === userId);
  }

  async isFavorite(userId: string, animalId: string): Promise<boolean> {
    const key = `${userId}:${animalId}`;
    return this.favorites.has(key);
  }

  async add(favorite: Favorite): Promise<void> {
    const key = `${favorite.userId}:${favorite.animalId}`;
    this.favorites.set(key, favorite);
  }

  async remove(userId: string, animalId: string): Promise<void> {
    const key = `${userId}:${animalId}`;
    this.favorites.delete(key);
  }

  // Métodos auxiliares para testes
  get size(): number {
    return this.favorites.size;
  }

  clear(): void {
    this.favorites.clear();
  }
}

export class InMemoryAdoptionInterestRepository implements AdoptionInterestRepository {
  private interests: Map<string, AdoptionInterest> = new Map();

  async save(interest: AdoptionInterest): Promise<void> {
    this.interests.set(interest.id, interest);
  }

  async findById(id: string): Promise<AdoptionInterest | null> {
    return this.interests.get(id) ?? null;
  }

  async listByUser(userId: string): Promise<AdoptionInterest[]> {
    return Array.from(this.interests.values()).filter((i) => i.userId === userId);
  }

  async listByAnimal(animalId: string): Promise<AdoptionInterest[]> {
    return Array.from(this.interests.values()).filter((i) => i.animalId === animalId);
  }

  async updateStatus(id: string, status: InterestStage): Promise<void> {
    const interest = this.interests.get(id);
    if (interest) {
      interest.transitionTo(status);
      this.interests.set(id, interest);
    }
  }

  // Métodos auxiliares para testes
  get size(): number {
    return this.interests.size;
  }

  clear(): void {
    this.interests.clear();
  }
}

export class InMemoryUserRepository implements UserRepository {
  private currentUser: User | null = null;

  async getCurrentUser(): Promise<User | null> {
    return this.currentUser;
  }

  async saveCurrentUser(user: User): Promise<void> {
    this.currentUser = user;
  }

  async clearCurrentUser(): Promise<void> {
    this.currentUser = null;
  }
}

export class InMemoryPhotoStorage implements PhotoStorage {
  private photos: Map<string, AnimalPhoto> = new Map();

  async persistLocal(photo: AnimalPhoto): Promise<AnimalPhoto> {
    this.photos.set(photo.id, photo);
    return photo;
  }

  async listPendingUpload(): Promise<AnimalPhoto[]> {
    return Array.from(this.photos.values()).filter((p) => !p.remoteUrl && p.localPath);
  }

  async uploadPending(photo: AnimalPhoto): Promise<AnimalPhoto> {
    const remoteUrl = `https://storage.example.com/${photo.id}.webp`;
    photo.markUploaded(remoteUrl);
    this.photos.set(photo.id, photo);
    return photo;
  }

  async remove(photoId: string): Promise<void> {
    this.photos.delete(photoId);
  }

  // Métodos auxiliares para testes
  get size(): number {
    return this.photos.size;
  }

  clear(): void {
    this.photos.clear();
  }

  getPhoto(id: string): AnimalPhoto | undefined {
    return this.photos.get(id);
  }
}

export class InMemoryAuthGateway implements AuthGateway {
  private session: AuthSession | null = null;

  async login(email: string, password: string): Promise<AuthSession> {
    const user = new User({
      id: 'user-1',
      name: 'Usuário Teste',
      email: email.toLowerCase(),
      contactInfo: '',
    });
    this.session = { user, accessToken: 'token-123' };
    return this.session;
  }

  async register(input: RegisterInput): Promise<AuthSession> {
    const user = new User({
      id: 'user-1',
      name: input.name,
      email: input.email.toLowerCase(),
      contactInfo: input.contactInfo ?? '',
    });
    this.session = { user, accessToken: 'token-123' };
    return this.session;
  }

  async restoreSession(): Promise<AuthSession | null> {
    return this.session;
  }

  async updateProfile(input: UpdateProfileInput): Promise<User> {
    const user = new User({
      id: input.userId,
      name: input.name,
      email: 'usuario@exemplo.com',
      contactInfo: input.contactInfo,
      bio: input.bio,
      avatarUrl: input.avatarUrl,
      interestsTags: input.interestsTags,
    });
    return user;
  }

  async logout(): Promise<void> {
    this.session = null;
  }

  // Métodos auxiliares para testes
  setSession(session: AuthSession | null): void {
    this.session = session;
  }
}

export class InMemoryLocationGateway implements LocationGateway {
  async getCurrentLocation(): Promise<ApproximateLocation> {
    return new ApproximateLocation({
      neighborhood: 'Centro',
      city: 'Varginha',
      region: 'MG',
      latitude: -21.55,
      longitude: -45.43,
    });
  }
}

export class InMemoryConnectivityGateway implements ConnectivityGateway {
  private connected = true;
  private listeners: Set<(isOnline: boolean) => void> = new Set();

  async isConnected(): Promise<boolean> {
    return this.connected;
  }

  subscribe(listener: (isOnline: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setConnected(connected: boolean): void {
    this.connected = connected;
    for (const listener of this.listeners) {
      listener(connected);
    }
  }
}

export class InMemoryRemoteAnimalSource implements RemoteAnimalSource {
  private animals: Map<string, Animal> = new Map();

  async listVisibleChangedAfter(
    cursor: DeltaCursor | null,
    limit: number = 100
  ): Promise<DeltaPage> {
    let results = Array.from(this.animals.values()).filter(
      (a) => !a.hidden
    );

    if (cursor) {
      results = results.filter(
        (a) =>
          a.updatedAt > cursor.updatedAt ||
          (a.updatedAt === cursor.updatedAt && a.id > cursor.id)
      );
    }

    results.sort((a, b) => {
      const cmp = a.updatedAt.localeCompare(b.updatedAt);
      if (cmp !== 0) return cmp;
      return a.id.localeCompare(b.id);
    });

    const page = results.slice(0, limit);
    const last = page[page.length - 1];

    return {
      animals: page,
      nextCursor: last
        ? { updatedAt: last.updatedAt, id: last.id }
        : null,
    };
  }

  async listTombstonesAfter?(
    cursor: DeltaCursor | null,
    limit: number = 100
  ): Promise<TombstonePage> {
    return { tombstones: [], nextCursor: null };
  }

  async findById(id: string): Promise<Animal | null> {
    return this.animals.get(id) ?? null;
  }

  async createRemote(animal: Animal): Promise<Animal> {
    const created = new Animal({
      id: animal.id,
      ownerId: animal.ownerId,
      name: animal.name,
      characteristics: animal.characteristics,
      location: animal.location,
      photos: animal.photos,
      status: animal.status,
      version: animal.version,
      createdAt: animal.createdAt,
      updatedAt: animal.updatedAt,
    });
    this.animals.set(animal.id, created);
    return created;
  }

  async updateRemote(animal: Animal, expectedVersion?: number): Promise<Animal> {
    if (expectedVersion !== undefined) {
      const existing = this.animals.get(animal.id);
      if (existing && existing.version >= expectedVersion + 1) {
        throw new Error('Conflito de versão: registro foi atualizado no servidor.');
      }
    }
    const updated = new Animal({
      id: animal.id,
      ownerId: animal.ownerId,
      name: animal.name,
      characteristics: animal.characteristics,
      location: animal.location,
      photos: animal.photos,
      status: animal.status,
      version: animal.version + 1,
      createdAt: animal.createdAt,
      updatedAt: animal.updatedAt,
    });
    this.animals.set(animal.id, updated);
    return updated;
  }

  async deleteRemote(animalId: string): Promise<void> {
    this.animals.delete(animalId);
  }

  // Métodos auxiliares para testes
  get size(): number {
    return this.animals.size;
  }

  clear(): void {
    this.animals.clear();
  }

  setAnimal(animal: Animal): void {
    this.animals.set(animal.id, animal);
  }
}

export class InMemoryFavoriteRemoteGateway implements FavoriteRemoteGateway {
  private favorites: Map<string, Favorite> = new Map();

  async listByUser(userId: string): Promise<Favorite[]> {
    return Array.from(this.favorites.values()).filter((f) => f.userId === userId);
  }

  async upsert(favorite: Favorite): Promise<void> {
    const key = `${favorite.userId}:${favorite.animalId}`;
    this.favorites.set(key, favorite);
  }

  async remove(userId: string, animalId: string): Promise<void> {
    const key = `${userId}:${animalId}`;
    this.favorites.delete(key);
  }

  // Métodos auxiliares para testes
  clear(): void {
    this.favorites.clear();
  }
}

export class InMemoryInterestRemoteGateway implements InterestRemoteGateway {
  private interests: Map<string, AdoptionInterest> = new Map();

  async upsert(interest: AdoptionInterest): Promise<void> {
    this.interests.set(interest.id, interest);
  }

  async updateStatus(id: string, status: InterestStage): Promise<void> {
    const interest = this.interests.get(id);
    if (interest) {
      interest.transitionTo(status);
      this.interests.set(id, interest);
    }
  }

  async listByUser(userId: string): Promise<AdoptionInterest[]> {
    return Array.from(this.interests.values()).filter((i) => i.userId === userId);
  }

  async listByAnimal(animalId: string): Promise<AdoptionInterest[]> {
    return Array.from(this.interests.values()).filter((i) => i.animalId === animalId);
  }

  // Métodos auxiliares para testes
  clear(): void {
    this.interests.clear();
  }
}

export class InMemoryModerationGateway implements ModerationGateway {
  private animals: Map<string, Animal> = new Map();
  private hidden: Set<string> = new Set();

  async listAllForModeration(): Promise<Animal[]> {
    return Array.from(this.animals.values());
  }

  async moderateAnimal(animalId: string, action: ModerationAction): Promise<void> {
    if (action === 'HIDE') {
      this.hidden.add(animalId);
    } else {
      this.hidden.delete(animalId);
    }
  }

  // Métodos auxiliares para testes
  setAnimal(animal: Animal): void {
    this.animals.set(animal.id, animal);
  }

  isHidden(animalId: string): boolean {
    return this.hidden.has(animalId);
  }

  clear(): void {
    this.animals.clear();
    this.hidden.clear();
  }
}

export class InMemoryAppStateRepository implements AppStateRepository {
  private store: Map<string, string> = new Map();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  // Métodos auxiliares para testes
  clear(): void {
    this.store.clear();
  }
}

export class InMemorySearchPreferencesRepository implements SearchPreferencesRepository {
  private preferences: SearchPreferences | null = null;

  async get(): Promise<SearchPreferences | null> {
    return this.preferences;
  }

  async save(preferences: SearchPreferences): Promise<void> {
    this.preferences = preferences;
  }

  async clear(): Promise<void> {
    this.preferences = null;
  }
}

export class InMemorySyncMetadataRepository implements SyncMetadataRepository {
  private metadata: Map<string, SyncMetadata> = new Map();

  async get(key: string): Promise<SyncMetadata | null> {
    return this.metadata.get(key) ?? null;
  }

  async save(metadata: SyncMetadata): Promise<void> {
    this.metadata.set(metadata.key, metadata);
  }

  // Métodos auxiliares para testes
  clear(): void {
    this.metadata.clear();
  }
}

export class InMemoryUnitOfWork implements UnitOfWork {
  async runInTransaction<T>(task: () => Promise<T>): Promise<T> {
    return task();
  }
}

// ============================================================================
// FABRICANTES DE DADOS DE TESTE
// ============================================================================

export function createTestAnimal(
  overrides: Partial<{
    id: string;
    ownerId: string;
    name: string;
    species: string;
    size: string;
    approximateAge: string;
    sex: string;
    status: 'AVAILABLE' | 'ADOPTED';
    hidden: boolean;
    version: number;
    photos: AnimalPhoto[];
  }> = {}
): Animal {
  const photos =
    overrides.photos ??
    [
      new AnimalPhoto({
        id: 'photo-1',
        animalId: overrides.id ?? 'animal-1',
        localPath: 'file:///amora.webp',
      }),
    ];

  return new Animal({
    id: overrides.id ?? 'animal-1',
    ownerId: overrides.ownerId ?? 'user-1',
    name: overrides.name ?? 'Amora',
    characteristics: new AnimalCharacteristics({
      species: overrides.species ?? 'Cão',
      size: overrides.size ?? 'Médio',
      approximateAge: overrides.approximateAge ?? '2 anos',
      sex: overrides.sex ?? 'Fêmea',
      behavior: 'Dócil e companheira',
    }),
    location: new ApproximateLocation({
      neighborhood: 'Centro',
      city: 'Varginha',
      latitude: -21.55,
      longitude: -45.43,
    }),
    status: overrides.status
      ? new AdoptionStatus(overrides.status)
      : AdoptionStatus.available(),
    photos,
    hidden: overrides.hidden ?? false,
    version: overrides.version ?? 1,
  });
}

export function createTestPhoto(
  overrides: Partial<{
    id: string;
    animalId: string;
    localPath: string;
    remoteUrl: string;
  }> = {}
): AnimalPhoto {
  return new AnimalPhoto({
    id: overrides.id ?? 'photo-1',
    animalId: overrides.animalId ?? 'animal-1',
    localPath: overrides.localPath ?? 'file:///photo.webp',
    remoteUrl: overrides.remoteUrl,
  });
}

export function createTestUser(
  overrides: Partial<{
    id: string;
    name: string;
    email: string;
    role: 'USER' | 'ADMIN';
  }> = {}
): User {
  return new User({
    id: overrides.id ?? 'user-1',
    name: overrides.name ?? 'Usuário Teste',
    email: overrides.email ?? 'usuario@exemplo.com',
    contactInfo: '35999990000',
    role: overrides.role ?? 'USER',
  });
}

export function createTestFavorite(
  overrides: Partial<{
    userId: string;
    animalId: string;
  }> = {}
): Favorite {
  return new Favorite({
    userId: overrides.userId ?? 'user-1',
    animalId: overrides.animalId ?? 'animal-1',
  });
}

export function createTestInterest(
  overrides: Partial<{
    id: string;
    userId: string;
    animalId: string;
    status: InterestStage;
  }> = {}
): AdoptionInterest {
  return new AdoptionInterest({
    id: overrides.id ?? 'interest-1',
    userId: overrides.userId ?? 'user-1',
    animalId: overrides.animalId ?? 'animal-1',
    message: 'Tenho interesse em adotar!',
    contactInfo: '35999990000',
    userName: 'Usuário Teste',
    status: overrides.status ?? 'ENVIADA',
  });
}

export function createTestSyncAction(
  overrides: Partial<{
    id: string;
    operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'MARK_ADOPTED' | 'UPLOAD_PHOTO';
    entityType: 'animal' | 'photo' | 'favorite' | 'interest';
    entityId: string;
    payload: Record<string, unknown>;
    ownerId: string;
    status: 'PENDING' | 'SYNCING' | 'FAILED' | 'COMPLETED';
  }> = {}
): SyncAction {
  return new SyncAction({
    id: overrides.id ?? 'action-1',
    operation: overrides.operation ?? 'CREATE',
    entityType: overrides.entityType ?? 'animal',
    entityId: overrides.entityId ?? 'animal-1',
    payload: overrides.payload ?? { ownerId: overrides.ownerId ?? 'user-1' },
    status: overrides.status ?? 'PENDING',
  });
}