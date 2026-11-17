import {
  createTestFavorite,
  InMemoryFavoriteRepository,
  InMemorySyncQueueRepository,
  InMemoryFavoriteRemoteGateway,
} from '../fakes/in-memory-repositories';
import { ToggleFavoriteUseCase } from '../../application/use-cases/ToggleFavoriteUseCase';

describe('ToggleFavoriteUseCase', () => {
  let favoriteRepository: InMemoryFavoriteRepository;
  let syncQueueRepository: InMemorySyncQueueRepository;
  let remoteFavorites: InMemoryFavoriteRemoteGateway;
  let useCase: ToggleFavoriteUseCase;

  beforeEach(() => {
    favoriteRepository = new InMemoryFavoriteRepository();
    syncQueueRepository = new InMemorySyncQueueRepository();
    remoteFavorites = new InMemoryFavoriteRemoteGateway();
    useCase = new ToggleFavoriteUseCase(
      favoriteRepository,
      syncQueueRepository,
      remoteFavorites
    );
  });

  it('deve adicionar um favorito quando ainda não existe', async () => {
    const result = await useCase.execute('user-1', 'animal-1', true);

    expect(result.favorited).toBe(true);
    expect(result.synced).toBe(true);

    const isFav = await favoriteRepository.isFavorite('user-1', 'animal-1');
    expect(isFav).toBe(true);
  });

  it('deve remover um favorito quando já existe', async () => {
    const fav = createTestFavorite({ userId: 'user-1', animalId: 'animal-1' });
    await favoriteRepository.add(fav);

    const result = await useCase.execute('user-1', 'animal-1', true);

    expect(result.favorited).toBe(false);
    expect(result.synced).toBe(true);

    const isFav = await favoriteRepository.isFavorite('user-1', 'animal-1');
    expect(isFav).toBe(false);
  });

  it('deve exigir usuário autenticado', async () => {
    await expect(useCase.execute('', 'animal-1', true)).rejects.toThrow(
      'É necessário estar autenticado'
    );
  });

  it('deve favoritar offline e enfileirar para sincronização', async () => {
    const useCaseOffline = new ToggleFavoriteUseCase(
      favoriteRepository,
      syncQueueRepository
    );

    const result = await useCaseOffline.execute('user-1', 'animal-1', false);

    expect(result.favorited).toBe(true);
    expect(result.synced).toBe(false);

    const isFav = await favoriteRepository.isFavorite('user-1', 'animal-1');
    expect(isFav).toBe(true);

    const pending = await syncQueueRepository.listPending();
    expect(pending.length).toBe(1);
    expect(pending[0].operation).toBe('CREATE');
  });

  it('deve sincronizar favorito remoto com sucesso quando online', async () => {
    const result = await useCase.execute('user-1', 'animal-1', true);

    expect(result.synced).toBe(true);

    const remoteFavs = await remoteFavorites.listByUser('user-1');
    expect(remoteFavs.length).toBe(1);
    expect(remoteFavs[0].animalId).toBe('animal-1');
  });

  it('deve enfileirar falha quando remoto falha', async () => {
    const failingRemote = {
      ...remoteFavorites,
      upsert: async () => {
        throw new Error('Servidor indisponível');
      },
    };

    const useCaseWithFailingRemote = new ToggleFavoriteUseCase(
      favoriteRepository,
      syncQueueRepository,
      failingRemote as any
    );

    const result = await useCaseWithFailingRemote.execute('user-1', 'animal-1', true);

    expect(result.favorited).toBe(true);
    expect(result.synced).toBe(false);

    const pending = await syncQueueRepository.listPending();
    expect(pending.length).toBe(1);
    expect(pending[0].status.isFailed()).toBe(true);
  });
});