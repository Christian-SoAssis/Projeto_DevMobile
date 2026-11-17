import {
  createTestAnimal,
  createTestPhoto,
  InMemoryAnimalRepository,
  InMemorySyncQueueRepository,
  InMemoryPhotoStorage,
  InMemoryUnitOfWork,
  InMemoryRemoteAnimalSource,
} from '../fakes/in-memory-repositories';
import { CreateAnimalUseCase } from '../../application/use-cases/CreateAnimalUseCase';
import { Animal } from '../../domain/entities/Animal';
import { AnimalCharacteristics } from '../../domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../domain/value-objects/ApproximateLocation';
import { AdoptionStatus } from '../../domain/value-objects/AdoptionStatus';

describe('CreateAnimalUseCase', () => {
  let animalRepository: InMemoryAnimalRepository;
  let syncQueueRepository: InMemorySyncQueueRepository;
  let photoStorage: InMemoryPhotoStorage;
  let unitOfWork: InMemoryUnitOfWork;
  let remoteAnimalSource: InMemoryRemoteAnimalSource;
  let useCase: CreateAnimalUseCase;

  beforeEach(() => {
    animalRepository = new InMemoryAnimalRepository();
    syncQueueRepository = new InMemorySyncQueueRepository();
    photoStorage = new InMemoryPhotoStorage();
    unitOfWork = new InMemoryUnitOfWork();
    remoteAnimalSource = new InMemoryRemoteAnimalSource();
    useCase = new CreateAnimalUseCase(
      animalRepository,
      syncQueueRepository,
      photoStorage,
      unitOfWork
    );
  });

  it('deve criar um anúncio offline sem sincronização remota', async () => {
    const animal = createTestAnimal({ ownerId: 'user-1' });

    const result = await useCase.execute(animal, false);

    expect(result.synced).toBe(false);
    expect(result.animal.id).toBe(animal.id);

    const saved = await animalRepository.findById(animal.id);
    expect(saved).not.toBeNull();
    expect(saved?.name).toBe('Amora');

    const pending = await syncQueueRepository.listPending();
    expect(pending.length).toBe(1);
    expect(pending[0].operation).toBe('CREATE');
    expect(pending[0].entityType).toBe('animal');
    expect(pending[0].entityId).toBe(animal.id);
  });

  it('deve criar um anúncio online e sincronizar com o servidor', async () => {
    const useCaseOnline = new CreateAnimalUseCase(
      animalRepository,
      syncQueueRepository,
      photoStorage,
      unitOfWork,
      remoteAnimalSource
    );

    const animal = createTestAnimal({ ownerId: 'user-1' });

    const result = await useCaseOnline.execute(animal, true);

    expect(result.synced).toBe(true);
    expect(result.animal.id).toBe(animal.id);

    const saved = await animalRepository.findById(animal.id);
    expect(saved).not.toBeNull();

    const pending = await syncQueueRepository.listPending();
    expect(pending.length).toBe(0); // ação foi deletada após sincronização
  });

  it('deve enfileirar ação CREATE quando offline mesmo com Supabase configurado', async () => {
    const useCaseWithRemote = new CreateAnimalUseCase(
      animalRepository,
      syncQueueRepository,
      photoStorage,
      unitOfWork,
      remoteAnimalSource
    );

    const animal = createTestAnimal({ ownerId: 'user-1' });

    const result = await useCaseWithRemote.execute(animal, false);

    expect(result.synced).toBe(false);

    const pending = await syncQueueRepository.listPending();
    expect(pending.length).toBe(1);
    expect(pending[0].operation).toBe('CREATE');
  });

  it('deve persistir fotos localmente antes de salvar o anúncio', async () => {
    const animalPhotos = [createTestPhoto({ localPath: 'file:///foto1.webp' })];
    const animal = createTestAnimal({
      ownerId: 'user-1',
      photos: animalPhotos,
    });

    await useCase.execute(animal, false);

    const pendingPhotos = await photoStorage.listPendingUpload();
    expect(pendingPhotos.length).toBeGreaterThan(0);
  });

  it('deve rejeitar anúncio com mais de 4 fotos', () => {
    const photos = [
      createTestPhoto({ id: 'p1', localPath: 'file:///p1.webp' }),
      createTestPhoto({ id: 'p2', localPath: 'file:///p2.webp' }),
      createTestPhoto({ id: 'p3', localPath: 'file:///p3.webp' }),
      createTestPhoto({ id: 'p4', localPath: 'file:///p4.webp' }),
      createTestPhoto({ id: 'p5', localPath: 'file:///p5.webp' }),
    ];

    expect(() => {
      new Animal({
        id: 'animal-overflow',
        ownerId: 'user-1',
        name: 'Excesso',
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
        photos: photos,
      });
    }).toThrow('no máximo 4 fotos');
  });

  it('deve usar UnitOfWork para transação atômica quando fornecido', async () => {
    let transactionExecuted = false;
    const uowWithTracking = {
      runInTransaction: async <T>(task: () => Promise<T>): Promise<T> => {
        transactionExecuted = true;
        return task();
      },
    };

    const useCaseWithUow = new CreateAnimalUseCase(
      animalRepository,
      syncQueueRepository,
      photoStorage,
      uowWithTracking as any
    );

    const animal = createTestAnimal({ ownerId: 'user-1' });
    await useCaseWithUow.execute(animal, false);

    expect(transactionExecuted).toBe(true);
  });

  it('deve marcar ação como falhada quando remoto falha', async () => {
    const failingRemote = {
      ...remoteAnimalSource,
      createRemote: async () => {
        throw new Error('Servidor indisponível');
      },
    };

    const useCaseWithFailingRemote = new CreateAnimalUseCase(
      animalRepository,
      syncQueueRepository,
      photoStorage,
      unitOfWork,
      failingRemote as any
    );

    const animal = createTestAnimal({ ownerId: 'user-1' });
    const result = await useCaseWithFailingRemote.execute(animal, true);

    expect(result.synced).toBe(false);

    const pending = await syncQueueRepository.listPending();
    expect(pending.length).toBe(1);
    expect(pending[0].status.isFailed()).toBe(true);
  });
});