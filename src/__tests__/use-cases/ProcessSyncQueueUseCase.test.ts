import {
  createTestAnimal,
  createTestInterest,
  createTestSyncAction,
  InMemoryAnimalRepository,
  InMemorySyncQueueRepository,
  InMemoryRemoteAnimalSource,
  InMemoryFavoriteRemoteGateway,
  InMemoryInterestRemoteGateway,
  InMemoryPhotoStorage,
} from '../fakes/in-memory-repositories';
import { ProcessSyncQueueUseCase } from '../../application/use-cases/ProcessSyncQueueUseCase';
import { ConflictResolutionService } from '../../domain/services/ConflictResolutionService';
import { Animal } from '../../domain/entities/Animal';
import { AdoptionStatus } from '../../domain/value-objects/AdoptionStatus';
import { AnimalCharacteristics } from '../../domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../domain/value-objects/ApproximateLocation';

describe('ProcessSyncQueueUseCase', () => {
  let syncQueueRepository: InMemorySyncQueueRepository;
  let animalRepository: InMemoryAnimalRepository;
  let remoteAnimalSource: InMemoryRemoteAnimalSource;
  let remoteFavorites: InMemoryFavoriteRemoteGateway;
  let remoteInterests: InMemoryInterestRemoteGateway;
  let remotePhotoStorage: InMemoryPhotoStorage;
  let useCase: ProcessSyncQueueUseCase;

  beforeEach(() => {
    syncQueueRepository = new InMemorySyncQueueRepository();
    animalRepository = new InMemoryAnimalRepository();
    remoteAnimalSource = new InMemoryRemoteAnimalSource();
    remoteFavorites = new InMemoryFavoriteRemoteGateway();
    remoteInterests = new InMemoryInterestRemoteGateway();
    remotePhotoStorage = new InMemoryPhotoStorage();
    useCase = new ProcessSyncQueueUseCase(
      syncQueueRepository,
      animalRepository,
      undefined,
      remotePhotoStorage,
      {
        remoteAnimals: remoteAnimalSource,
        favorites: remoteFavorites,
        interests: remoteInterests,
        currentUserId: () => 'user-1',
      }
    );
  });

  it('deve processar ação CREATE de animal online com sucesso', async () => {
    const animal = createTestAnimal({ id: 'animal-1', ownerId: 'user-1' });
    await animalRepository.saveLocal(animal);

    const action = createTestSyncAction({
      id: 'action-1',
      operation: 'CREATE',
      entityType: 'animal',
      entityId: 'animal-1',
      ownerId: 'user-1',
    });
    await syncQueueRepository.enqueue(action);

    const result = await useCase.execute();

    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);

    const pending = await syncQueueRepository.listPending();
    expect(pending.length).toBe(0); // ação foi deletada após sucesso
  });

  it('deve pular ações de outra conta (DAT-10)', async () => {
    const animal = createTestAnimal({ id: 'animal-1', ownerId: 'user-ana' });
    await animalRepository.saveLocal(animal);

    const action = createTestSyncAction({
      id: 'action-1',
      operation: 'CREATE',
      entityType: 'animal',
      entityId: 'animal-1',
      ownerId: 'user-ana', // outra conta
    });
    await syncQueueRepository.enqueue(action);

    const result = await useCase.execute();

    expect(result.processed).toBe(0);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(0);

    // Ação ainda está pendente (não foi processada)
    const pending = await syncQueueRepository.listPending();
    expect(pending.length).toBe(1);
  });

  it('deve processar favorito com sucesso', async () => {
    const action = createTestSyncAction({
      id: 'action-1',
      operation: 'CREATE',
      entityType: 'favorite',
      entityId: 'user-1:animal-1',
      ownerId: 'user-1',
      payload: { userId: 'user-1', animalId: 'animal-1' },
    });
    await syncQueueRepository.enqueue(action);

    const result = await useCase.execute();

    expect(result.succeeded).toBe(1);

    const remoteFavs = await remoteFavorites.listByUser('user-1');
    expect(remoteFavs.length).toBe(1);
  });

  it('deve processar interesse com sucesso', async () => {
    const action = createTestSyncAction({
      id: 'action-1',
      operation: 'CREATE',
      entityType: 'interest',
      entityId: 'interest-1',
      ownerId: 'user-1',
      payload: {
        userId: 'user-1',
        animalId: 'animal-1',
        message: 'Tenho interesse!',
        contactInfo: '35999990000',
        status: 'ENVIADA',
      },
    });
    await syncQueueRepository.enqueue(action);

    const result = await useCase.execute();

    expect(result.succeeded).toBe(1);

    const remoteList = await remoteInterests.listByUser('user-1');
    expect(remoteList.length).toBe(1);
  });

  it('deve remover remotamente um interesse cancelado que estava na fila offline', async () => {
    const interest = createTestInterest({ id: 'interest-cancelado', userId: 'user-1' });
    await remoteInterests.upsert(interest);
    await syncQueueRepository.enqueue(
      createTestSyncAction({
        id: 'action-cancel-interest',
        operation: 'DELETE',
        entityType: 'interest',
        entityId: interest.id,
        ownerId: interest.userId,
      })
    );

    const result = await useCase.execute();

    expect(result.succeeded).toBe(1);
    expect(await remoteInterests.listByUser(interest.userId)).toEqual([]);
    expect(await syncQueueRepository.listPending()).toEqual([]);
  });

  it('deve detectar conflito quando status diverge (AVAILABLE vs ADOPTED)', async () => {
    const localAnimal = createTestAnimal({
      id: 'animal-1',
      ownerId: 'user-1',
      version: 1,
      status: 'AVAILABLE',
      name: 'Amora Local',
    });
    await animalRepository.saveLocal(localAnimal);

    const remoteAnimal = createTestAnimal({
      id: 'animal-1',
      ownerId: 'user-1',
      version: 2,
      status: 'ADOPTED', // status divergente
      name: 'Amora Remota',
    });
    remoteAnimalSource.setAnimal(remoteAnimal);

    const action = createTestSyncAction({
      id: 'action-1',
      operation: 'UPDATE',
      entityType: 'animal',
      entityId: 'animal-1',
      ownerId: 'user-1',
      payload: { ownerId: 'user-1', expectedVersion: 1 },
    });
    await syncQueueRepository.enqueue(action);

    const result = await useCase.execute();

    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.conflicts[0].animalId).toBe('animal-1');
  });

  it('deve aplicar last-write wins quando remoto é mais recente sem conflito de status', async () => {
    const localAnimal = new Animal({
      id: 'animal-1',
      ownerId: 'user-1',
      name: 'Amora Local',
      characteristics: new AnimalCharacteristics({
        species: 'Cão',
        size: 'Médio',
        approximateAge: '2 anos',
        sex: 'Fêmea',
      }),
      location: new ApproximateLocation({
        neighborhood: 'Centro',
        city: 'Varginha',
      }),
      status: AdoptionStatus.available(),
      version: 1,
      updatedAt: '2026-11-17T10:00:00.000Z', // mais antigo
    });
    await animalRepository.saveLocal(localAnimal);

    // Remoto com updatedAt mais recente (simula último gravação no servidor)
    const remoteAnimal = new Animal({
      id: 'animal-1',
      ownerId: 'user-1',
      name: 'Amora Atualizada',
      characteristics: new AnimalCharacteristics({
        species: 'Cão',
        size: 'Médio',
        approximateAge: '2 anos',
        sex: 'Fêmea',
      }),
      location: new ApproximateLocation({
        neighborhood: 'Centro',
        city: 'Varginha',
      }),
      status: AdoptionStatus.available(), // mesmo status
      version: 2,
      updatedAt: '2026-11-17T12:00:00.000Z', // mais recente
    });
    remoteAnimalSource.setAnimal(remoteAnimal);

    const action = createTestSyncAction({
      id: 'action-1',
      operation: 'UPDATE',
      entityType: 'animal',
      entityId: 'animal-1',
      ownerId: 'user-1',
      payload: { ownerId: 'user-1', expectedVersion: 1 },
    });
    await syncQueueRepository.enqueue(action);

    const result = await useCase.execute();

    expect(result.succeeded).toBe(1);
    expect(result.conflicts.length).toBe(0);

    // O animal local deve ter sido atualizado com a versão remota (REMOTE venceu por updatedAt mais recente)
    const saved = await animalRepository.findById('animal-1');
    expect(saved?.name).toBe('Amora Atualizada');
  });

  it('deve deletar animal remoto quando operação é DELETE', async () => {
    remoteAnimalSource.setAnimal(createTestAnimal({ id: 'animal-1' }));

    const action = createTestSyncAction({
      id: 'action-1',
      operation: 'DELETE',
      entityType: 'animal',
      entityId: 'animal-1',
      ownerId: 'user-1',
    });
    await syncQueueRepository.enqueue(action);

    const result = await useCase.execute();

    expect(result.succeeded).toBe(1);

    const exists = await remoteAnimalSource.findById('animal-1');
    expect(exists).toBeNull();
  });

  it('deve marcar ação como falhada quando remoto lança erro', async () => {
    const failingRemote = {
      ...remoteAnimalSource,
      createRemote: async () => {
        throw new Error('Servidor indisponível');
      },
    };

    const useCaseWithFailingRemote = new ProcessSyncQueueUseCase(
      syncQueueRepository,
      animalRepository,
      undefined,
      undefined,
      {
        remoteAnimals: failingRemote as any,
        currentUserId: () => 'user-1',
      }
    );

    const animal = createTestAnimal({ id: 'animal-1', ownerId: 'user-1' });
    await animalRepository.saveLocal(animal);

    const action = createTestSyncAction({
      id: 'action-1',
      operation: 'CREATE',
      entityType: 'animal',
      entityId: 'animal-1',
      ownerId: 'user-1',
    });
    await syncQueueRepository.enqueue(action);

    const result = await useCaseWithFailingRemote.execute();

    expect(result.failed).toBe(1);
    expect(result.succeeded).toBe(0);

    const pending = await syncQueueRepository.listPending();
    expect(pending.length).toBe(1);
    expect(pending[0].status.isFailed()).toBe(true);
  });

  it('deve retornar resultado vazio quando não há ações pendentes', async () => {
    const result = await useCase.execute();

    expect(result.processed).toBe(0);
    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.conflicts.length).toBe(0);
  });
});
