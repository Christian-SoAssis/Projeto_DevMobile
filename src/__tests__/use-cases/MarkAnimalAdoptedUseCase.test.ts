import {
  createTestAnimal,
  InMemoryAnimalRepository,
  InMemorySyncQueueRepository,
} from '../fakes/in-memory-repositories';
import { MarkAnimalAdoptedUseCase } from '../../application/use-cases/MarkAnimalAdoptedUseCase';
import { AdoptionStatus } from '../../domain/value-objects/AdoptionStatus';
import { Animal } from '../../domain/entities/Animal';

describe('MarkAnimalAdoptedUseCase', () => {
  let animalRepository: InMemoryAnimalRepository;
  let syncQueueRepository: InMemorySyncQueueRepository;
  let useCase: MarkAnimalAdoptedUseCase;

  beforeEach(() => {
    animalRepository = new InMemoryAnimalRepository();
    syncQueueRepository = new InMemorySyncQueueRepository();
    useCase = new MarkAnimalAdoptedUseCase(
      animalRepository,
      syncQueueRepository
    );
  });

  it('deve marcar animal como adotado', async () => {
    const animal = createTestAnimal({
      id: 'animal-1',
      ownerId: 'user-1',
      name: 'Amora',
      status: 'AVAILABLE',
    });
    await animalRepository.saveLocal(animal);

    const result = await useCase.execute('animal-1', 'user-1', false);

    expect(result.animal.status.isAdopted()).toBe(true);
    expect(result.synced).toBe(false);

    const saved = await animalRepository.findById('animal-1');
    expect(saved?.status.isAdopted()).toBe(true);
  });

  it('deve rejeitar marcar animal já adotado', async () => {
    const animal = createTestAnimal({
      id: 'animal-1',
      ownerId: 'user-1',
      name: 'Amora',
      status: 'ADOPTED',
    });
    await animalRepository.saveLocal(animal);

    await expect(
      useCase.execute('animal-1', 'user-1', false)
    ).rejects.toThrow('já está marcado como adotado');
  });

  it('deve rejeitar marcar anúncio de outro usuário', async () => {
    const animal = createTestAnimal({
      id: 'animal-1',
      ownerId: 'user-ana',
      name: 'Amora',
      status: 'AVAILABLE',
    });
    await animalRepository.saveLocal(animal);

    await expect(
      useCase.execute('animal-1', 'user-carlos', false)
    ).rejects.toThrow('Somente o responsável');
  });

  it('deve sincronizar adoção com servidor quando online', async () => {
    const simpleRemote = {
      findById: async () => null,
      updateRemote: async (animal: Animal) => animal,
      createRemote: async (animal: Animal) => animal,
      deleteRemote: async () => {},
      listVisibleChangedAfter: async () => ({ animals: [], nextCursor: null }),
    };

    const useCaseOnline = new MarkAnimalAdoptedUseCase(
      animalRepository,
      syncQueueRepository,
      simpleRemote as any
    );

    const animal = createTestAnimal({
      id: 'animal-1',
      ownerId: 'user-1',
      name: 'Amora',
      status: 'AVAILABLE',
      version: 1,
    });
    await animalRepository.saveLocal(animal);

    const result = await useCaseOnline.execute('animal-1', 'user-1', true);

    expect(result.synced).toBe(true);

    const pending = await syncQueueRepository.listPending();
    expect(pending.length).toBe(0);
  });

  it('deve enfileirar MARK_ADOPTED quando offline', async () => {
    const animal = createTestAnimal({
      id: 'animal-1',
      ownerId: 'user-1',
      name: 'Amora',
      status: 'AVAILABLE',
    });
    await animalRepository.saveLocal(animal);

    await useCase.execute('animal-1', 'user-1', false);

    const pending = await syncQueueRepository.listPending();
    expect(pending.length).toBe(1);
    expect(pending[0].operation).toBe('MARK_ADOPTED');
  });
});