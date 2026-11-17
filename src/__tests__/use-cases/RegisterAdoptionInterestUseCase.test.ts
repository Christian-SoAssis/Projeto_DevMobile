import {
  createTestAnimal,
  createTestInterest,
  InMemoryAnimalRepository,
  InMemoryAdoptionInterestRepository,
  InMemorySyncQueueRepository,
  InMemoryInterestRemoteGateway,
} from '../fakes/in-memory-repositories';
import { RegisterAdoptionInterestUseCase } from '../../application/use-cases/RegisterAdoptionInterestUseCase';

describe('RegisterAdoptionInterestUseCase', () => {
  let animalRepository: InMemoryAnimalRepository;
  let interestRepository: InMemoryAdoptionInterestRepository;
  let syncQueueRepository: InMemorySyncQueueRepository;
  let remoteInterests: InMemoryInterestRemoteGateway;
  let useCase: RegisterAdoptionInterestUseCase;

  beforeEach(() => {
    animalRepository = new InMemoryAnimalRepository();
    interestRepository = new InMemoryAdoptionInterestRepository();
    syncQueueRepository = new InMemorySyncQueueRepository();
    remoteInterests = new InMemoryInterestRemoteGateway();
    useCase = new RegisterAdoptionInterestUseCase(
      interestRepository,
      animalRepository,
      syncQueueRepository,
      remoteInterests
    );
  });

  it('deve registrar interesse em animal disponível', async () => {
    const animal = createTestAnimal({
      id: 'animal-1',
      status: 'AVAILABLE',
    });
    await animalRepository.saveLocal(animal);

    const result = await useCase.execute({
      userId: 'user-1',
      userName: 'Carlos',
      animalId: 'animal-1',
      message: 'Tenho quintal telado!',
      contactInfo: '35999990000',
      isOnline: true,
    });

    expect(result.interest.userId).toBe('user-1');
    expect(result.interest.animalId).toBe('animal-1');
    expect(result.interest.status).toBe('ENVIADA');
    expect(result.synced).toBe(true);

    const remote = await remoteInterests.listByUser('user-1');
    expect(remote.length).toBe(1);
  });

  it('deve rejeitar interesse em animal não disponível', async () => {
    const animal = createTestAnimal({
      id: 'animal-1',
      status: 'ADOPTED',
    });
    await animalRepository.saveLocal(animal);

    await expect(
      useCase.execute({
        userId: 'user-1',
        animalId: 'animal-1',
        isOnline: true,
      })
    ).rejects.toThrow('já foi adotado');
  });

  it('deve rejeitar interesse em animal inexistente', async () => {
    await expect(
      useCase.execute({
        userId: 'user-1',
        animalId: 'animal-inexistente',
        isOnline: true,
      })
    ).rejects.toThrow('Anúncio não encontrado.');
  });

  it('deve exigir usuário autenticado', async () => {
    await expect(
      useCase.execute({
        userId: '',
        animalId: 'animal-1',
        isOnline: true,
      })
    ).rejects.toThrow('Faça login');
  });

  it('deve registrar interesse offline e enfileirar', async () => {
    const animal = createTestAnimal({
      id: 'animal-1',
      status: 'AVAILABLE',
    });
    await animalRepository.saveLocal(animal);

    const useCaseOffline = new RegisterAdoptionInterestUseCase(
      interestRepository,
      animalRepository,
      syncQueueRepository
    );

    const result = await useCaseOffline.execute({
      userId: 'user-1',
      animalId: 'animal-1',
      isOnline: false,
    });

    expect(result.synced).toBe(false);
    expect(result.interest.status).toBe('ENVIADA');

    const pending = await syncQueueRepository.listPending();
    expect(pending.length).toBe(1);
    expect(pending[0].entityType).toBe('interest');
  });

  it('deve salvar interesse localmente mesmo quando remoto falha', async () => {
    const animal = createTestAnimal({
      id: 'animal-1',
      status: 'AVAILABLE',
    });
    await animalRepository.saveLocal(animal);

    const failingRemote = {
      ...remoteInterests,
      upsert: async () => {
        throw new Error('Servidor indisponível');
      },
    };

    const useCaseWithFailingRemote = new RegisterAdoptionInterestUseCase(
      interestRepository,
      animalRepository,
      syncQueueRepository,
      failingRemote as any
    );

    const result = await useCaseWithFailingRemote.execute({
      userId: 'user-1',
      animalId: 'animal-1',
      isOnline: true,
    });

    expect(result.synced).toBe(false);

    const saved = await interestRepository.findById(result.interest.id);
    expect(saved).not.toBeNull();
  });

  it('deve definir mensagem padrão quando não fornecida', async () => {
    const animal = createTestAnimal({
      id: 'animal-1',
      status: 'AVAILABLE',
    });
    await animalRepository.saveLocal(animal);

    const result = await useCase.execute({
      userId: 'user-1',
      animalId: 'animal-1',
      isOnline: true,
    });

    expect(result.interest.message).toContain('interesse');
  });
});