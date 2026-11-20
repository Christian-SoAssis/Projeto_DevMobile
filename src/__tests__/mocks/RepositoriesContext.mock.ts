import { AppContainer } from '../../infrastructure/composition/loadAppContainer';

export const RepositoriesContext = {
  Provider: ({ children }: any) => children,
};

export function useRepositories(): AppContainer {
  return {
    mode: 'memory',
    remoteMode: 'none',
    animalRepository: { search: jest.fn(), findById: jest.fn(), saveLocal: jest.fn(), deleteLocal: jest.fn(), upsertCache: jest.fn(), findByOwner: jest.fn() } as any,
    favoriteRepository: { add: jest.fn(), remove: jest.fn(), isFavorite: jest.fn(), listByUser: jest.fn() } as any,
    interestRepository: { save: jest.fn(), listByUser: jest.fn(), listByAnimal: jest.fn(), findById: jest.fn(), updateStatus: jest.fn() } as any,
    syncQueueRepository: { enqueue: jest.fn(), listPending: jest.fn(), findById: jest.fn(), update: jest.fn(), delete: jest.fn() } as any,
    photoStorage: { persistLocal: jest.fn(), listPendingUpload: jest.fn(), uploadPending: jest.fn(), remove: jest.fn() } as any,
    userRepository: { getCurrentUser: jest.fn(), saveCurrentUser: jest.fn(), clearCurrentUser: jest.fn() } as any,
    searchPreferencesRepository: { get: jest.fn(), save: jest.fn(), clear: jest.fn() } as any,
    syncMetadataRepository: { get: jest.fn(), save: jest.fn() } as any,
    appStateRepository: { get: jest.fn(), set: jest.fn() } as any,
    unitOfWork: { runInTransaction: jest.fn() } as any,
    cameraGateway: { capturePhoto: jest.fn(), pickImageFromGallery: jest.fn() } as any,
    locationGateway: { getCurrentLocation: jest.fn() } as any,
  } as AppContainer;
}

export function RepositoriesProvider({ children }: any) {
  return children;
}
