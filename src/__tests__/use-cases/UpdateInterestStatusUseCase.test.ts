import {
  createTestAnimal,
  createTestInterest,
  InMemoryAnimalRepository,
  InMemoryAdoptionInterestRepository,
  InMemorySyncQueueRepository,
  InMemoryInterestRemoteGateway,
  InMemoryRemoteAnimalSource,
} from '../fakes/in-memory-repositories';
import { UpdateInterestStatusUseCase } from '../../application/use-cases/UpdateInterestStatusUseCase';

describe('UpdateInterestStatusUseCase', () => {
  let animalRepository: InMemoryAnimalRepository;
  let interestRepository: InMemoryAdoptionInterestRepository;
  let syncQueueRepository: InMemorySyncQueueRepository;
  let remoteInterests: InMemoryInterestRemoteGateway;
  let remoteAnimalSource: InMemoryRemoteAnimalSource;
  let useCase: UpdateInterestStatusUseCase;

  beforeEach(() => {
    animalRepository = new InMemoryAnimalRepository();
    interestRepository = new InMemoryAdoptionInterestRepository();
    syncQueueRepository = new InMemorySyncQueueRepository();
    remoteInterests = new InMemoryInterestRemoteGateway();
    remoteAnimalSource = new InMemoryRemoteAnimalSource();
    useCase = new UpdateInterestStatusUseCase(
      interestRepository,
      animalRepository,
      syncQueueRepository,
      remoteInterests,
      remoteAnimalSource
    );
  });

  it('deve avançar status de interesse para EM_ANALISE', async () => {
    const animal = createTestAnimal({ id: 'animal-1', ownerId: 'user-dono', status: 'AVAILABLE' });
    const interest = createTestInterest({ id: 'int-1', animalId: 'animal-1', status: 'ENVIADA' });
    await animalRepository.saveLocal(animal);
    await interestRepository.save(interest);

    const result = await useCase.execute('int-1', 'user-dono', 'EM_ANALISE', false);

    expect(result.animalMarkedAdopted).toBe(false);
    const updated = await interestRepository.findById('int-1');
    expect(updated?.status).toBe('EM_ANALISE');
  });

  it('deve rejeitar atualização por usuário não autorizado', async () => {
    const animal = createTestAnimal({ id: 'animal-1', ownerId: 'user-dono', status: 'AVAILABLE' });
    const interest = createTestInterest({ id: 'int-1', animalId: 'animal-1', status: 'ENVIADA' });
    await animalRepository.saveLocal(animal);
    await interestRepository.save(interest);

    await expect(
      useCase.execute('int-1', 'user-outro', 'EM_ANALISE', false)
    ).rejects.toThrow('Somente o responsável');
  });

  it('deve rejeitar interesse inexistente', async () => {
    await expect(
      useCase.execute('int-inexistente', 'user-dono', 'EM_ANALISE', false)
    ).rejects.toThrow('não encontrada');
  });

  it('deve marcar animal como adotado automaticamente ao concluir', async () => {
    const animal = createTestAnimal({ id: 'animal-1', ownerId: 'user-dono', status: 'AVAILABLE' });
    const interest = createTestInterest({ id: 'int-1', animalId: 'animal-1', status: 'VISITA_COMBINADA' });
    await animalRepository.saveLocal(animal);
    await interestRepository.save(interest);

    const result = await useCase.execute('int-1', 'user-dono', 'CONCLUIDA', false);

    expect(result.animalMarkedAdopted).toBe(true);

    // Animal deve estar marcado como adotado no repositório local
    const savedAnimal = await animalRepository.findById('animal-1');
    expect(savedAnimal?.status.isAdopted()).toBe(true);

    // Interest deve estar com status CONCLUIDA
    const savedInterest = await interestRepository.findById('int-1');
    expect(savedInterest?.status).toBe('CONCLUIDA');
  });

  it('deve enfileirar MARK_ADOPTED junto com UPDATE de interesse ao concluir offline', async () => {
    const animal = createTestAnimal({ id: 'animal-1', ownerId: 'user-dono', status: 'AVAILABLE' });
    const interest = createTestInterest({ id: 'int-1', animalId: 'animal-1', status: 'VISITA_COMBINADA' });
    await animalRepository.saveLocal(animal);
    await interestRepository.save(interest);

    await useCase.execute('int-1', 'user-dono', 'CONCLUIDA', false);

    const pending = await syncQueueRepository.listPending();
    const adoptActions = pending.filter((a) => a.operation === 'MARK_ADOPTED');
    const interestActions = pending.filter((a) => a.entityType === 'interest');

    // Ambas as ações devem estar na fila
    expect(adoptActions.length).toBe(1);
    expect(interestActions.length).toBe(1);
    expect(adoptActions[0].entityId).toBe('animal-1');
    expect(interestActions[0].entityId).toBe('int-1');
  });

  it('não deve marcar animal como adotado quando status não é CONCLUIDA', async () => {
    const animal = createTestAnimal({ id: 'animal-1', ownerId: 'user-dono', status: 'AVAILABLE' });
    const interest = createTestInterest({ id: 'int-1', animalId: 'animal-1', status: 'ENVIADA' });
    await animalRepository.saveLocal(animal);
    await interestRepository.save(interest);

    const result = await useCase.execute('int-1', 'user-dono', 'EM_ANALISE', false);

    expect(result.animalMarkedAdopted).toBe(false);
    const savedAnimal = await animalRepository.findById('animal-1');
    expect(savedAnimal?.status.isAvailable()).toBe(true);

    const pending = await syncQueueRepository.listPending();
    const adoptActions = pending.filter((a) => a.operation === 'MARK_ADOPTED');
    expect(adoptActions.length).toBe(0);
  });

  it('não deve tentar marcar animal já adotado quando status é CONCLUIDA', async () => {
    // Animal já adotado (ex: outra manifestação já foi concluída antes)
    const animal = createTestAnimal({ id: 'animal-1', ownerId: 'user-dono', status: 'ADOPTED' });
    const interest = createTestInterest({ id: 'int-2', animalId: 'animal-1', status: 'VISITA_COMBINADA' });
    await animalRepository.saveLocal(animal);
    await interestRepository.save(interest);

    // Deve concluir o interesse sem erro (animal já estava adotado)
    const result = await useCase.execute('int-2', 'user-dono', 'CONCLUIDA', false);

    expect(result.animalMarkedAdopted).toBe(false);

    const pending = await syncQueueRepository.listPending();
    const adoptActions = pending.filter((a) => a.operation === 'MARK_ADOPTED');
    expect(adoptActions.length).toBe(0);
  });

  it('deve sincronizar interesse online sem enfileirar quando remoto funciona', async () => {
    const animal = createTestAnimal({ id: 'animal-1', ownerId: 'user-dono', status: 'AVAILABLE' });
    const interest = createTestInterest({ id: 'int-1', animalId: 'animal-1', status: 'ENVIADA' });
    await animalRepository.saveLocal(animal);
    await interestRepository.save(interest);
    await remoteInterests.upsert(interest); // pré-popula o remoto

    const result = await useCase.execute('int-1', 'user-dono', 'EM_ANALISE', true);

    expect(result.synced).toBe(true);
    const pending = await syncQueueRepository.listPending();
    const interestActions = pending.filter((a) => a.entityType === 'interest');
    expect(interestActions.length).toBe(0);
  });

  it('deve sincronizar imediatamente o status ADOPTED do animal no servidor remoto ao concluir interesse online', async () => {
    const animal = createTestAnimal({ id: 'animal-online-adopt', ownerId: 'user-dono', status: 'AVAILABLE' });
    const interest = createTestInterest({ id: 'int-online-adopt', animalId: 'animal-online-adopt', status: 'VISITA_COMBINADA' });
    await animalRepository.saveLocal(animal);
    await remoteAnimalSource.createRemote(animal);
    await interestRepository.save(interest);
    await remoteInterests.upsert(interest);

    const result = await useCase.execute('int-online-adopt', 'user-dono', 'CONCLUIDA', true);

    expect(result.synced).toBe(true);
    expect(result.animalMarkedAdopted).toBe(true);

    const localAnimal = await animalRepository.findById('animal-online-adopt');
    expect(localAnimal?.status.isAdopted()).toBe(true);

    const remoteAnimal = await remoteAnimalSource.findById('animal-online-adopt');
    expect(remoteAnimal?.status.isAdopted()).toBe(true);

    const pending = await syncQueueRepository.listPending();
    expect(pending.length).toBe(0);
  });

  it('deve enfileirar quando sync remoto de interesse falha online', async () => {
    const failingRemote = {
      ...remoteInterests,
      updateStatus: async () => {
        throw new Error('Servidor indisponível');
      },
    } as any;

    const useCaseWithFailingRemote = new UpdateInterestStatusUseCase(
      interestRepository,
      animalRepository,
      syncQueueRepository,
      failingRemote,
      remoteAnimalSource
    );

    const animal = createTestAnimal({ id: 'animal-1', ownerId: 'user-dono', status: 'AVAILABLE' });
    const interest = createTestInterest({ id: 'int-1', animalId: 'animal-1', status: 'ENVIADA' });
    await animalRepository.saveLocal(animal);
    await interestRepository.save(interest);

    const result = await useCaseWithFailingRemote.execute('int-1', 'user-dono', 'EM_ANALISE', true);

    expect(result.synced).toBe(false);
    const pending = await syncQueueRepository.listPending();
    const interestActions = pending.filter((a) => a.entityType === 'interest');
    expect(interestActions.length).toBe(1);
  });

  it('deve permitir voltar atrás de RECUSADA para EM_ANALISE', async () => {
    const animal = createTestAnimal({ id: 'animal-1', ownerId: 'user-dono', status: 'AVAILABLE' });
    const interest = createTestInterest({ id: 'int-1', animalId: 'animal-1', status: 'RECUSADA' });
    await animalRepository.saveLocal(animal);
    await interestRepository.save(interest);

    const result = await useCase.execute('int-1', 'user-dono', 'EM_ANALISE', false);

    expect(result.animalMarkedAdopted).toBe(false);
    const updated = await interestRepository.findById('int-1');
    expect(updated?.status).toBe('EM_ANALISE');
  });

  it('deve permitir voltar atrás de RECUSADA para ENVIADA', async () => {
    const animal = createTestAnimal({ id: 'animal-1', ownerId: 'user-dono', status: 'AVAILABLE' });
    const interest = createTestInterest({ id: 'int-1', animalId: 'animal-1', status: 'RECUSADA' });
    await animalRepository.saveLocal(animal);
    await interestRepository.save(interest);

    const result = await useCase.execute('int-1', 'user-dono', 'ENVIADA', false);

    expect(result.animalMarkedAdopted).toBe(false);
    const updated = await interestRepository.findById('int-1');
    expect(updated?.status).toBe('ENVIADA');
  });

  it('deve permitir voltar atrás de RECUSADA para VISITA_COMBINADA', async () => {
    const animal = createTestAnimal({ id: 'animal-1', ownerId: 'user-dono', status: 'AVAILABLE' });
    const interest = createTestInterest({ id: 'int-1', animalId: 'animal-1', status: 'RECUSADA' });
    await animalRepository.saveLocal(animal);
    await interestRepository.save(interest);

    const result = await useCase.execute('int-1', 'user-dono', 'VISITA_COMBINADA', false);

    expect(result.animalMarkedAdopted).toBe(false);
    const updated = await interestRepository.findById('int-1');
    expect(updated?.status).toBe('VISITA_COMBINADA');
  });

  it('deve permitir voltar atrás de RECUSADA para CONCLUIDA e marcar animal como adotado', async () => {
    const animal = createTestAnimal({ id: 'animal-1', ownerId: 'user-dono', status: 'AVAILABLE' });
    const interest = createTestInterest({ id: 'int-1', animalId: 'animal-1', status: 'RECUSADA' });
    await animalRepository.saveLocal(animal);
    await interestRepository.save(interest);

    const result = await useCase.execute('int-1', 'user-dono', 'CONCLUIDA', false);

    expect(result.animalMarkedAdopted).toBe(true);
    const updatedInterest = await interestRepository.findById('int-1');
    expect(updatedInterest?.status).toBe('CONCLUIDA');

    const updatedAnimal = await animalRepository.findById('animal-1');
    expect(updatedAnimal?.status.isAdopted()).toBe(true);
  });
});
