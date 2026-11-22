import { AppContainer } from '../../infrastructure/composition/loadAppContainer';

export const mockRepositories = {
  mode: 'memory' as const,
  remoteMode: 'none' as const,
  animalRepository: {
    search: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    saveLocal: jest.fn().mockResolvedValue(undefined),
    deleteLocal: jest.fn().mockResolvedValue(undefined),
    upsertCache: jest.fn().mockResolvedValue(undefined),
    findByOwner: jest.fn().mockResolvedValue([]),
  },
  favoriteRepository: {
    add: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    isFavorite: jest.fn().mockResolvedValue(false),
    listByUser: jest.fn().mockResolvedValue([]),
  },
  interestRepository: {
    save: jest.fn().mockResolvedValue(undefined),
    listByUser: jest.fn().mockResolvedValue([]),
    listByAnimal: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    updateStatus: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  },
  syncQueueRepository: {
    enqueue: jest.fn().mockResolvedValue(undefined),
    listPending: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  },
  photoStorage: {
    persistLocal: jest.fn().mockResolvedValue(''),
    listPendingUpload: jest.fn().mockResolvedValue([]),
    uploadPending: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  },
  userRepository: {
    getCurrentUser: jest.fn().mockResolvedValue(null),
    saveCurrentUser: jest.fn().mockResolvedValue(undefined),
    clearCurrentUser: jest.fn().mockResolvedValue(undefined),
  },
  searchPreferencesRepository: {
    get: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  },
  syncMetadataRepository: {
    get: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue(undefined),
  },
  appStateRepository: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
  unitOfWork: {
    runInTransaction: jest.fn().mockImplementation((cb: any) => cb()),
  },
  cameraGateway: {
    capturePhoto: jest.fn().mockResolvedValue(null),
    pickImageFromGallery: jest.fn().mockResolvedValue(null),
  },
  locationGateway: {
    getCurrentLocation: jest.fn().mockResolvedValue(null),
  },
  remoteFavorites: {
    add: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  },
  remoteInterests: {
    upsert: jest.fn().mockResolvedValue(undefined),
    updateStatus: jest.fn().mockResolvedValue(undefined),
    listByUser: jest.fn().mockResolvedValue([]),
    listByAnimal: jest.fn().mockResolvedValue([]),
    remove: jest.fn().mockResolvedValue(undefined),
  },
};

export const RepositoriesContext = {
  Provider: ({ children }: any) => children,
};

export function useRepositories(): AppContainer {
  return mockRepositories as unknown as AppContainer;
}

export function RepositoriesProvider({ children }: any) {
  return children;
}
