import {
  createTestAnimal,
  InMemoryAnimalRepository,
  InMemorySyncQueueRepository,
} from '../fakes/in-memory-repositories';
import { SearchAnimalsUseCase } from '../../application/use-cases/SearchAnimalsUseCase';
import { AdoptionStatus } from '../../domain/value-objects/AdoptionStatus';

// Helper para criar SyncAction de forma simplificada nos testes
import { SyncAction } from '../../domain/entities/SyncAction';

describe('SearchAnimalsUseCase', () => {
  let animalRepository: InMemoryAnimalRepository;
  let syncQueueRepository: InMemorySyncQueueRepository;
  let useCase: SearchAnimalsUseCase;

  beforeEach(() => {
    animalRepository = new InMemoryAnimalRepository();
    syncQueueRepository = new InMemorySyncQueueRepository();
    useCase = new SearchAnimalsUseCase(animalRepository, syncQueueRepository);
  });

  it('deve retornar animais disponíveis por padrão', async () => {
    const available = createTestAnimal({
      id: 'animal-1',
      name: 'Amora',
      status: 'AVAILABLE',
    });
    const adopted = createTestAnimal({
      id: 'animal-2',
      name: 'Bidu',
      status: 'ADOPTED',
    });

    await animalRepository.saveLocal(available);
    await animalRepository.saveLocal(adopted);

    const results = await useCase.execute({});

    expect(results.length).toBe(1);
    expect(results[0].id).toBe('animal-1');
  });

  it('deve filtrar por espécie', async () => {
    const cao = createTestAnimal({
      id: 'animal-1',
      name: 'Amora',
      species: 'Cão',
    });
    const gato = createTestAnimal({
      id: 'animal-2',
      name: 'Mia',
      species: 'Gato',
    });

    await animalRepository.saveLocal(cao);
    await animalRepository.saveLocal(gato);

    const results = await useCase.execute({ species: 'Cão' });

    expect(results.length).toBe(1);
    expect(results[0].characteristics.species).toBe('Cão');
  });

  it('deve filtrar por porte', async () => {
    const pequeno = createTestAnimal({
      id: 'animal-1',
      name: 'Pipoca',
      size: 'Pequeno',
    });
    const grande = createTestAnimal({
      id: 'animal-2',
      name: 'Rex',
      size: 'Grande',
    });

    await animalRepository.saveLocal(pequeno);
    await animalRepository.saveLocal(grande);

    const results = await useCase.execute({ size: 'Pequeno' });

    expect(results.length).toBe(1);
    expect(results[0].characteristics.size).toBe('Pequeno');
  });

  it('deve buscar por texto no nome', async () => {
    const amora = createTestAnimal({
      id: 'animal-1',
      name: 'Amora',
    });
    const luna = createTestAnimal({
      id: 'animal-2',
      name: 'Luna',
    });

    await animalRepository.saveLocal(amora);
    await animalRepository.saveLocal(luna);

    const results = await useCase.execute({ query: 'ora' });

    expect(results.length).toBe(1);
    expect(results[0].name).toBe('Amora');
  });

  it('deve filtrar por dono', async () => {
    const animalAna = createTestAnimal({
      id: 'animal-1',
      name: 'Amora',
      ownerId: 'user-ana',
    });
    const animalCarlos = createTestAnimal({
      id: 'animal-2',
      name: 'Rex',
      ownerId: 'user-carlos',
    });

    await animalRepository.saveLocal(animalAna);
    await animalRepository.saveLocal(animalCarlos);

    const results = await useCase.execute({ ownerId: 'user-ana' });

    expect(results.length).toBe(1);
    expect(results[0].ownerId).toBe('user-ana');
  });

  it('deve ocultar rascunhos pendentes de outra conta (DAT-10)', async () => {
    // Animal-3 salvo por Ana no banco local (rascunho dela)
    const animalAnaDraft = createTestAnimal({
      id: 'animal-3',
      name: 'Rascunho Ana',
      ownerId: 'user-ana',
    });
    await animalRepository.saveLocal(animalAnaDraft);

    // Rascunho pendente CREATE de Ana para animal-3
    const anaDraft = new SyncAction({
      id: 'action-ana',
      operation: 'CREATE',
      entityType: 'animal',
      entityId: 'animal-3',
      payload: { ownerId: 'user-ana' },
    });
    await syncQueueRepository.enqueue(anaDraft);

    // Carlos não deve ver o rascunho pendente de Ana (animal-3)
    const resultsForCarlos = await useCase.execute({
      currentUserId: 'user-carlos',
    });
    expect(
      resultsForCarlos.some((a) => a.id === 'animal-3')
    ).toBe(false);

    // Ana deve ver seu próprio rascunho pendente (animal-3)
    const resultsForAna = await useCase.execute({
      currentUserId: 'user-ana',
    });
    expect(resultsForAna.some((a) => a.id === 'animal-3')).toBe(true);
  });

  it('deve funcionar sem syncQueueRepository', async () => {
    const useCaseWithoutQueue = new SearchAnimalsUseCase(animalRepository);

    const animal = createTestAnimal({ id: 'animal-1', name: 'Amora' });
    await animalRepository.saveLocal(animal);

    const results = await useCaseWithoutQueue.execute({});

    expect(results.length).toBe(1);
    expect(results[0].id).toBe('animal-1');
  });
});