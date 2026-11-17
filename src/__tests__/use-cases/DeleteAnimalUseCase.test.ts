import {
  createTestAnimal,
  InMemoryAnimalRepository,
  InMemorySyncQueueRepository,
  InMemoryRemoteAnimalSource,
} from '../fakes/in-memory-repositories';
import { DeleteAnimalUseCase } from '../../application/use-cases/DeleteAnimalUseCase';

describe('DeleteAnimalUseCase', () => {
  let animalRepository: InMemoryAnimalRepository;
  let syncQueueRepository: InMemorySyncQueueRepository;
  let remoteAnimalSource: InMemoryRemoteAnimalSource;
  let useCase: DeleteAnimalUseCase;

  beforeEach(() => {
    animalRepository = new InMemoryAnimalRepository();
    syncQueueRepository = new InMemorySyncQueueRepository();
    remoteAnimalSource = new InMemoryRemoteAnimalSource();
    useCase = new DeleteAnimalUseCase(
      animalRepository,
      syncQueueRepository
    );
  });

  it('deve excluir um anúncio existente offline (enfileira para sincronização)', async () => {
    const animal = createTestAnimal({
      id: 'animal-1',
      ownerId: 'user-1',
      name: 'Amora',
    });
    await animalRepository.saveLocal(animal);

    // Offline: retorna false (não confirmado pelo servidor), mas exclui localmente
    const result = await useCase.execute('animal-1', 'user-1', false);

    expect(result).toBe(false);

    const saved = await animalRepository.findById('animal-1');
    expect(saved).toBeNull();

    const pending = await syncQueueRepository.listPending();
    expect(pending.length).toBe(1);
    expect(pending[0].operation).toBe('DELETE');
  });

  it('deve excluir remoto quando online com sucesso', async () => {
    const useCaseOnline = new DeleteAnimalUseCase(
      animalRepository,
      syncQueueRepository,
      remoteAnimalSource
    );

    const animal = createTestAnimal({
      id: 'animal-1',
      ownerId: 'user-1',
      name: 'Amora',
    });
    await animalRepository.saveLocal(animal);
    remoteAnimalSource.setAnimal(animal);

    const result = await useCaseOnline.execute('animal-1', 'user-1', true);

    expect(result).toBe(true);

    const remote = await remoteAnimalSource.findById('animal-1');
    expect(remote).toBeNull();

    const pending = await syncQueueRepository.listPending();
    expect(pending.length).toBe(0);
  });

  it('deve rejeitar exclusão de anúncio inexistente', async () => {
    await expect(
      useCase.execute('animal-inexistente', 'user-1', false)
    ).rejects.toThrow('Anúncio não encontrado.');
  });

  it('deve rejeitar exclusão por não-dono', async () => {
    const animal = createTestAnimal({
      id: 'animal-1',
      ownerId: 'user-ana',
      name: 'Amora',
    });
    await animalRepository.saveLocal(animal);

    await expect(
      useCase.execute('animal-1', 'user-carlos', false)
    ).rejects.toThrow('Somente o responsável');
  });

  it('deve excluir remoto quando online com sucesso', async () => {
    const useCaseOnline = new DeleteAnimalUseCase(
      animalRepository,
      syncQueueRepository,
      remoteAnimalSource
    );

    const animal = createTestAnimal({
      id: 'animal-1',
      ownerId: 'user-1',
      name: 'Amora',
    });
    await animalRepository.saveLocal(animal);
    remoteAnimalSource.setAnimal(animal);

    const result = await useCaseOnline.execute('animal-1', 'user-1', true);

    expect(result).toBe(true);

    const remote = await remoteAnimalSource.findById('animal-1');
    expect(remote).toBeNull();

    const pending = await syncQueueRepository.listPending();
    expect(pending.length).toBe(0);
  });

  it('deve enfileirar DELETE quando remoto falha', async () => {
    const useCaseOnline = new DeleteAnimalUseCase(
      animalRepository,
      syncQueueRepository,
      {
        ...remoteAnimalSource,
        deleteRemote: async () => {
          throw new Error('Servidor indisponível');
        },
      } as any
    );

    const animal = createTestAnimal({
      id: 'animal-1',
      ownerId: 'user-1',
      name: 'Amora',
    });
    await animalRepository.saveLocal(animal);

    const result = await useCaseOnline.execute('animal-1', 'user-1', true);

    expect(result).toBe(false);

    const pending = await syncQueueRepository.listPending();
    expect(pending.length).toBe(1);
    expect(pending[0].status.isFailed()).toBe(true);
  });
});