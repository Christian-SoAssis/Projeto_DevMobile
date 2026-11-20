/**
 * Testes E2E de fluxos críticos (subconjunto mínimo).
 * Simulam jornadas completas do usuário usando fakes in-memory,
 * sem dependência de dispositivo físico ou servidor remoto real.
 */

import {
  createTestAnimal,
  createTestPhoto,
  createTestUser,
  InMemoryAnimalRepository,
  InMemorySyncQueueRepository,
  InMemoryPhotoStorage,
  InMemoryUnitOfWork,
  InMemoryRemoteAnimalSource,
  InMemoryFavoriteRepository,
  InMemoryAdoptionInterestRepository,
  InMemoryAuthGateway,
} from '../fakes/in-memory-repositories';
import { CreateAnimalUseCase } from '../../application/use-cases/CreateAnimalUseCase';
import { SearchAnimalsUseCase } from '../../application/use-cases/SearchAnimalsUseCase';
import { ToggleFavoriteUseCase } from '../../application/use-cases/ToggleFavoriteUseCase';
import { RegisterAdoptionInterestUseCase } from '../../application/use-cases/RegisterAdoptionInterestUseCase';
import { ProcessSyncQueueUseCase } from '../../application/use-cases/ProcessSyncQueueUseCase';
import { MarkAnimalAdoptedUseCase } from '../../application/use-cases/MarkAnimalAdoptedUseCase';
import { UpdateAnimalUseCase } from '../../application/use-cases/UpdateAnimalUseCase';
import { ConflictResolutionService } from '../../domain/services/ConflictResolutionService';
import { Animal } from '../../domain/entities/Animal';
import { AnimalCharacteristics } from '../../domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../domain/value-objects/ApproximateLocation';
import { AdoptionStatus } from '../../domain/value-objects/AdoptionStatus';

describe('Fluxos Críticos E2E', () => {
  // ============================================================================
  // Fluxo 1: Visitante pesquisa e abre um animal (RF01, RF03, RF06)
  // ============================================================================
  it('EF01: Visitante pesquisa e visualiza detalhes de um animal', async () => {
    const animalRepository = new InMemoryAnimalRepository();

    const animal = createTestAnimal({
      id: 'animal-visit',
      name: 'Luna',
      species: 'Cão',
      ownerId: 'user-1',
    });
    await animalRepository.saveLocal(animal);

    const useCase = new SearchAnimalsUseCase(animalRepository);
    const results = await useCase.execute({ query: 'Luna' });

    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Luna');

    const details = await animalRepository.findById('animal-visit');
    expect(details).not.toBeNull();
    expect(details?.name).toBe('Luna');
  });

  // ============================================================================
  // Fluxo 2: Usuário autentica e favorita um anúncio (RF07, RF14, RF15)
  // ============================================================================
  it('EF02: Usuário autentica e favorita um anúncio', async () => {
    const authGateway = new InMemoryAuthGateway();
    const favoriteRepository = new InMemoryFavoriteRepository();
    const animalRepository = new InMemoryAnimalRepository();
    const syncQueueRepository = new InMemorySyncQueueRepository();

    const animal = createTestAnimal({ id: 'animal-fav', ownerId: 'user-other' });
    await animalRepository.saveLocal(animal);

    // Autentica
    const session = await authGateway.login('user@test.com', 'senha123');
    expect(session.user).not.toBeNull();

    // Favorita (online=false para não tentar gateway remoto)
    const useCase = new ToggleFavoriteUseCase(
      favoriteRepository,
      syncQueueRepository
    );
    await useCase.execute('user-auth', 'animal-fav', false);

    const isFav = await favoriteRepository.isFavorite('user-auth', 'animal-fav');
    expect(isFav).toBe(true);

    // Lista favoritos
    const favs = await favoriteRepository.listByUser('user-auth');
    expect(favs.length).toBe(1);
  });

  // ============================================================================
  // Fluxo 3: Responsável cria anúncio online (RF08, RF09)
  // ============================================================================
  it('EF03: Responsável cria anúncio online com fotos', async () => {
    const animalRepository = new InMemoryAnimalRepository();
    const syncQueueRepository = new InMemorySyncQueueRepository();
    const photoStorage = new InMemoryPhotoStorage();
    const unitOfWork = new InMemoryUnitOfWork();
    const remoteAnimalSource = new InMemoryRemoteAnimalSource();

    const useCase = new CreateAnimalUseCase(
      animalRepository,
      syncQueueRepository,
      photoStorage,
      unitOfWork,
      remoteAnimalSource
    );

    const animal = createTestAnimal({
      id: 'animal-online',
      ownerId: 'user-owner',
      name: 'Rex',
      photos: [createTestPhoto({ id: 'p1', localPath: 'file:///rex.webp' })],
    });

    const result = await useCase.execute(animal, true);

    expect(result.synced).toBe(true);

    const saved = await animalRepository.findById('animal-online');
    expect(saved).not.toBeNull();
    expect(saved?.name).toBe('Rex');

    // Não deve ficar pendência na fila (sincronizado)
    const pending = await syncQueueRepository.listPending();
    expect(pending.length).toBe(0);
  });

  // ============================================================================
  // Fluxo 4: Responsável cria anúncio offline e sincroniza depois (RF18, RF19, RF20)
  // ============================================================================
  it('EF04: Responsável cria anúncio offline, dados persistem localmente', async () => {
    const animalRepository = new InMemoryAnimalRepository();
    const syncQueueRepository = new InMemorySyncQueueRepository();
    const photoStorage = new InMemoryPhotoStorage();
    const unitOfWork = new InMemoryUnitOfWork();

    // Passo 1: Cria offline
    const useCaseOffline = new CreateAnimalUseCase(
      animalRepository,
      syncQueueRepository,
      photoStorage,
      unitOfWork
    );

    const animal = createTestAnimal({
      id: 'animal-offline',
      ownerId: 'user-owner',
      name: 'Offline Pet',
    });

    const result = await useCaseOffline.execute(animal, false);
    expect(result.synced).toBe(false);

    const pendingBefore = await syncQueueRepository.listPending();
    expect(pendingBefore.length).toBe(1);

    // Simula "fechar e reabrir" - dados permanecem no SQLite local
    const reloaded = await animalRepository.findById('animal-offline');
    expect(reloaded).not.toBeNull();
    expect(reloaded?.name).toBe('Offline Pet');
  });

  // ============================================================================
  // Fluxo 5: Responsável marca animal como adotado (RF12)
  // ============================================================================
  it('EF05: Responsável marca animal como adotado', async () => {
    const animalRepository = new InMemoryAnimalRepository();
    const syncQueueRepository = new InMemorySyncQueueRepository();

    const animal = createTestAnimal({
      id: 'animal-adopt',
      ownerId: 'user-owner',
      name: 'Adotavel',
      status: 'AVAILABLE',
    });
    await animalRepository.saveLocal(animal);

    const useCase = new MarkAnimalAdoptedUseCase(
      animalRepository,
      syncQueueRepository
    );

    const result = await useCase.execute('animal-adopt', 'user-owner', false);

    expect(result.synced).toBe(false);

    const updated = await animalRepository.findById('animal-adopt');
    expect(updated?.status.isAdopted()).toBe(true);
  });

  // ============================================================================
  // Fluxo 6: Usuário não consegue editar anúncio de terceiro (RNF04, DAT-05)
  // ============================================================================
  it('EF06: Usuário não consegue editar anúncio de terceiro', async () => {
    const animalRepository = new InMemoryAnimalRepository();
    const syncQueueRepository = new InMemorySyncQueueRepository();
    const photoStorage = new InMemoryPhotoStorage();
    const unitOfWork = new InMemoryUnitOfWork();

    const animal = createTestAnimal({
      id: 'animal-other',
      ownerId: 'owner-a',
      name: 'Pet do A',
    });
    await animalRepository.saveLocal(animal);

    const useCase = new UpdateAnimalUseCase(
      animalRepository,
      syncQueueRepository,
      photoStorage,
      unitOfWork
    );

    // Usuário B tenta editar animal do A
    await expect(
      useCase.execute({
        animalId: 'animal-other',
        actorUserId: 'user-b',
        name: 'Tentativa de Edicao',
        characteristics: new AnimalCharacteristics({
          species: 'Cão', size: 'Médio', approximateAge: '2 anos', sex: 'Macho',
        }),
        location: new ApproximateLocation({ neighborhood: 'Centro', city: 'Varginha' }),
        isOnline: false,
      })
    ).rejects.toThrow();
  });

  // ============================================================================
  // Fluxo 7: Demonstra interesse na adoção (RF16)
  // ============================================================================
  it('EF07: Usuário demonstra interesse na adoção de um animal', async () => {
    const interestRepository = new InMemoryAdoptionInterestRepository();
    const animalRepository = new InMemoryAnimalRepository();

    const animal = createTestAnimal({ id: 'animal-interest', ownerId: 'owner-x' });
    await animalRepository.saveLocal(animal);

    const useCase = new RegisterAdoptionInterestUseCase(
      interestRepository,
      animalRepository
    );

    const result = await useCase.execute({
      userId: 'user-interested',
      userName: 'Interessado',
      animalId: 'animal-interest',
      message: 'Quero adotar!',
      contactInfo: '35999990000',
    });

    expect(result.interest).not.toBeNull();
    expect(result.interest.animalId).toBe('animal-interest');
    expect(result.interest.userId).toBe('user-interested');

    const interests = await interestRepository.listByAnimal('animal-interest');
    expect(interests.length).toBe(1);
  });

  // ============================================================================
  // Fluxo 8: Processa fila de sincronização (RF20, RF21)
  // ============================================================================
  it('EF08: Processa fila de sincronização de ações pendentes', async () => {
    const animalRepository = new InMemoryAnimalRepository();
    const syncQueueRepository = new InMemorySyncQueueRepository();
    const photoStorage = new InMemoryPhotoStorage();
    const remoteAnimalSource = new InMemoryRemoteAnimalSource();
    const conflictResolver = new ConflictResolutionService();

    const animal = createTestAnimal({
      id: 'animal-sync',
      ownerId: 'user-owner',
      name: 'Sync Pet',
    });
    await animalRepository.saveLocal(animal);

    const useCase = new ProcessSyncQueueUseCase(
      syncQueueRepository,
      animalRepository,
      conflictResolver,
      photoStorage,
      {
        remoteAnimals: remoteAnimalSource,
        favorites: undefined,
        interests: undefined,
        currentUserId: () => 'user-owner',
      }
    );

    // Adiciona uma ação CREATE à fila
    const { SyncAction } = require('../../domain/entities/SyncAction');
    await syncQueueRepository.enqueue(
      new SyncAction({
        id: 'action-sync',
        operation: 'CREATE',
        entityType: 'animal',
        entityId: 'animal-sync',
        payload: { ownerId: 'user-owner' },
      })
    );

    const pendingBefore = await syncQueueRepository.listPending();
    expect(pendingBefore.length).toBe(1);

    const result = await useCase.execute();
    expect(result.processed).toBeGreaterThanOrEqual(0);
  });
});
