import {
  createTestAnimal,
  createTestPhoto,
  InMemoryAnimalRepository,
  InMemorySyncQueueRepository,
  InMemoryPhotoStorage,
  InMemoryUnitOfWork,
  InMemoryRemoteAnimalSource,
} from '../fakes/in-memory-repositories';
import { UpdateAnimalUseCase } from '../../application/use-cases/UpdateAnimalUseCase';
import { AnimalCharacteristics } from '../../domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../domain/value-objects/ApproximateLocation';
import { AdoptionStatus } from '../../domain/value-objects/AdoptionStatus';

describe('UpdateAnimalUseCase', () => {
  let animalRepository: InMemoryAnimalRepository;
  let syncQueueRepository: InMemorySyncQueueRepository;
  let photoStorage: InMemoryPhotoStorage;
  let unitOfWork: InMemoryUnitOfWork;
  let remoteAnimalSource: InMemoryRemoteAnimalSource;
  let useCase: UpdateAnimalUseCase;

  beforeEach(() => {
    animalRepository = new InMemoryAnimalRepository();
    syncQueueRepository = new InMemorySyncQueueRepository();
    photoStorage = new InMemoryPhotoStorage();
    unitOfWork = new InMemoryUnitOfWork();
    remoteAnimalSource = new InMemoryRemoteAnimalSource();
    useCase = new UpdateAnimalUseCase(
      animalRepository,
      syncQueueRepository,
      photoStorage,
      unitOfWork
    );
  });

  it('deve atualizar um anúncio existente', async () => {
    const animal = createTestAnimal({
      id: 'animal-1',
      ownerId: 'user-1',
      name: 'Amora',
    });
    await animalRepository.saveLocal(animal);

    const result = await useCase.execute({
      animalId: 'animal-1',
      actorUserId: 'user-1',
      name: 'Amora Atualizada',
      isOnline: false,
    });

    expect(result.animal.name).toBe('Amora Atualizada');
    expect(result.synced).toBe(false);

    const saved = await animalRepository.findById('animal-1');
    expect(saved?.name).toBe('Amora Atualizada');
  });

  it('deve rejeitar atualização de anúncio inexistente', async () => {
    await expect(
      useCase.execute({
        animalId: 'animal-inexistente',
        actorUserId: 'user-1',
        isOnline: false,
      })
    ).rejects.toThrow('Anúncio não encontrado.');
  });

  it('deve rejeitar atualização por não-dono', async () => {
    const animal = createTestAnimal({
      id: 'animal-1',
      ownerId: 'user-ana',
      name: 'Amora',
    });
    await animalRepository.saveLocal(animal);

    await expect(
      useCase.execute({
        animalId: 'animal-1',
        actorUserId: 'user-carlos',
        isOnline: false,
      })
    ).rejects.toThrow('Somente o responsável');
  });

  it('deve atualizar características e localização', async () => {
    const animal = createTestAnimal({
      id: 'animal-1',
      ownerId: 'user-1',
      name: 'Amora',
    });
    await animalRepository.saveLocal(animal);

    const result = await useCase.execute({
      animalId: 'animal-1',
      actorUserId: 'user-1',
      characteristics: new AnimalCharacteristics({
        species: 'Gato',
        size: 'Pequeno',
        approximateAge: '1 ano',
        sex: 'Macho',
        behavior: 'Muito brincalhão',
      }),
      location: new ApproximateLocation({
        neighborhood: 'Vila Pinto',
        city: 'Varginha',
        latitude: -21.56,
        longitude: -45.44,
      }),
      isOnline: false,
    });

    expect(result.animal.characteristics.species).toBe('Gato');
    expect(result.animal.characteristics.size).toBe('Pequeno');
    expect(result.animal.location.neighborhood).toBe('Vila Pinto');
    expect(result.animal.location.city).toBe('Varginha');
  });

  it('deve sincronizar com servidor quando online', async () => {
    const useCaseOnline = new UpdateAnimalUseCase(
      animalRepository,
      syncQueueRepository,
      photoStorage,
      unitOfWork,
      remoteAnimalSource
    );

    const animal = createTestAnimal({
      id: 'animal-1',
      ownerId: 'user-1',
      name: 'Amora',
      version: 1,
    });
    await animalRepository.saveLocal(animal);

    const result = await useCaseOnline.execute({
      animalId: 'animal-1',
      actorUserId: 'user-1',
      name: 'Amora Atualizada',
      isOnline: true,
    });

    expect(result.synced).toBe(true);

    const pending = await syncQueueRepository.listPending();
    expect(pending.length).toBe(0);
  });

  it('deve enfileirar UPDATE quando offline', async () => {
    const animal = createTestAnimal({
      id: 'animal-1',
      ownerId: 'user-1',
      name: 'Amora',
    });
    await animalRepository.saveLocal(animal);

    await useCase.execute({
      animalId: 'animal-1',
      actorUserId: 'user-1',
      name: 'Amora Atualizada',
      isOnline: false,
    });

    const pending = await syncQueueRepository.listPending();
    expect(pending.length).toBe(1);
    expect(pending[0].operation).toBe('UPDATE');
  });
});