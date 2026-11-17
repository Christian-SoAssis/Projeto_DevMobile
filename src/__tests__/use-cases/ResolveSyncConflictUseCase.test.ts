import {
  createTestAnimal,
  InMemoryAnimalRepository,
  InMemorySyncQueueRepository,
  InMemoryRemoteAnimalSource,
} from '../fakes/in-memory-repositories';
import { ResolveSyncConflictUseCase } from '../../application/use-cases/ResolveSyncConflictUseCase';

describe('ResolveSyncConflictUseCase', () => {
  let animalRepository: InMemoryAnimalRepository;
  let syncQueueRepository: InMemorySyncQueueRepository;
  let remoteAnimalSource: InMemoryRemoteAnimalSource;
  let useCase: ResolveSyncConflictUseCase;

  beforeEach(() => {
    animalRepository = new InMemoryAnimalRepository();
    syncQueueRepository = new InMemorySyncQueueRepository();
    remoteAnimalSource = new InMemoryRemoteAnimalSource();
    useCase = new ResolveSyncConflictUseCase(
      animalRepository,
      syncQueueRepository,
      remoteAnimalSource
    );
  });

  it('deve manter versão local (KEEP_LOCAL)', async () => {
    const localAnimal = createTestAnimal({
      id: 'animal-1',
      ownerId: 'user-1',
      name: 'Amora Local',
      status: 'AVAILABLE',
    });
    await animalRepository.saveLocal(localAnimal);

    const remoteAnimal = createTestAnimal({
      id: 'animal-1',
      ownerId: 'user-1',
      name: 'Amora Remota',
      status: 'ADOPTED',
    });
    remoteAnimalSource.setAnimal(remoteAnimal);

    // Adicionar ação pendente
    const syncAction = new (require('../../domain/entities/SyncAction').SyncAction)({
      id: 'action-1',
      operation: 'UPDATE',
      entityType: 'animal',
      entityId: 'animal-1',
      payload: { ownerId: 'user-1' },
    });
    await syncQueueRepository.enqueue(syncAction);

    const result = await useCase.execute('animal-1', 'KEEP_LOCAL');

    expect(result.name).toBe('Amora Local');

    // Ação pendente deve ser removida
    const pending = await syncQueueRepository.listPending();
    expect(pending.length).toBe(0);
  });

  it('deve usar versão remota (USE_REMOTE)', async () => {
    const localAnimal = createTestAnimal({
      id: 'animal-1',
      ownerId: 'user-1',
      name: 'Amora Local',
    });
    await animalRepository.saveLocal(localAnimal);

    const remoteAnimal = createTestAnimal({
      id: 'animal-1',
      ownerId: 'user-1',
      name: 'Amora Remota',
      status: 'ADOPTED',
    });
    remoteAnimalSource.setAnimal(remoteAnimal);

    const result = await useCase.execute('animal-1', 'USE_REMOTE');

    expect(result.name).toBe('Amora Remota');
    expect(result.status.isAdopted()).toBe(true);

    const saved = await animalRepository.findById('animal-1');
    expect(saved?.status.isAdopted()).toBe(true);
  });

  it('deve lançar erro se USE_REMOTE sem versão remota', async () => {
    await expect(
      useCase.execute('animal-inexistente', 'USE_REMOTE')
    ).rejects.toThrow('Versão online não disponível');
  });

  it('deve lançar erro se KEEP_LOCAL sem versão local', async () => {
    await expect(
      useCase.execute('animal-inexistente', 'KEEP_LOCAL')
    ).rejects.toThrow('Versão local não encontrada');
  });

  it('deve funcionar sem remoteAnimalSource (apenas KEEP_LOCAL)', async () => {
    const useCaseNoRemote = new ResolveSyncConflictUseCase(
      animalRepository,
      syncQueueRepository
    );

    const localAnimal = createTestAnimal({
      id: 'animal-1',
      ownerId: 'user-1',
      name: 'Amora Local',
    });
    await animalRepository.saveLocal(localAnimal);

    const result = await useCaseNoRemote.execute('animal-1', 'KEEP_LOCAL');

    expect(result.name).toBe('Amora Local');
  });
});