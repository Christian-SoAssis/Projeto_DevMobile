import { PullRemoteInterestsUseCase } from '../../application/use-cases/PullRemoteInterestsUseCase';
import {
  createTestAnimal,
  createTestInterest,
  createTestSyncAction,
  InMemoryAdoptionInterestRepository,
  InMemoryAnimalRepository,
  InMemoryInterestRemoteGateway,
  InMemoryAppStateRepository,
  InMemorySyncQueueRepository,
} from '../fakes/in-memory-repositories';

describe('PullRemoteInterestsUseCase', () => {
  let localInterests: InMemoryAdoptionInterestRepository;
  let animals: InMemoryAnimalRepository;
  let queue: InMemorySyncQueueRepository;
  let remote: InMemoryInterestRemoteGateway;
  let appState: InMemoryAppStateRepository;

  beforeEach(() => {
    localInterests = new InMemoryAdoptionInterestRepository();
    animals = new InMemoryAnimalRepository();
    queue = new InMemorySyncQueueRepository();
    remote = new InMemoryInterestRemoteGateway();
    appState = new InMemoryAppStateRepository();
  });

  it('atualiza no mesmo pull interesses enviados e recebidos pelo usuário ativo', async () => {
    const ownedAnimal = createTestAnimal({ id: 'animal-meu', ownerId: 'dono' });
    await animals.saveLocal(ownedAnimal);

    const sent = createTestInterest({
      id: 'interest-enviado',
      userId: 'dono',
      animalId: 'animal-de-outro',
      status: 'VISITA_COMBINADA',
    });
    const received = createTestInterest({
      id: 'interest-recebido',
      userId: 'interessado',
      animalId: ownedAnimal.id,
      status: 'EM_ANALISE',
    });
    await remote.upsert(sent);
    await remote.upsert(received);

    const result = await new PullRemoteInterestsUseCase(
      remote,
      localInterests,
      animals,
      queue,
      appState,
      { currentUserId: () => 'dono' }
    ).execute();

    expect(result).toEqual({
      upserted: 2,
      removed: 0,
      withdrawals: 0,
      skippedPending: 0,
      failedRequests: 0,
    });
    expect(await localInterests.findById(sent.id)).toMatchObject({ status: 'VISITA_COMBINADA' });
    expect(await localInterests.findById(received.id)).toMatchObject({ status: 'EM_ANALISE' });
  });

  it('não sobrescreve uma etapa local que ainda aguarda envio', async () => {
    const local = createTestInterest({
      id: 'interest-pendente',
      userId: 'interessado',
      animalId: 'animal-meu',
      status: 'ENVIADA',
    });
    const remoteVersion = createTestInterest({
      id: local.id,
      userId: 'interessado',
      animalId: local.animalId,
      status: 'EM_ANALISE',
    });
    await animals.saveLocal(createTestAnimal({ id: local.animalId, ownerId: 'dono' }));
    await localInterests.save(local);
    await remote.upsert(remoteVersion);
    await queue.enqueue(
      createTestSyncAction({
        entityType: 'interest',
        entityId: local.id,
        ownerId: 'dono',
        operation: 'UPDATE',
      })
    );

    const result = await new PullRemoteInterestsUseCase(
      remote,
      localInterests,
      animals,
      queue,
      appState,
      { currentUserId: () => 'dono' }
    ).execute();

    expect(result).toEqual({
      upserted: 0,
      removed: 0,
      withdrawals: 0,
      skippedPending: 1,
      failedRequests: 0,
    });
    expect((await localInterests.findById(local.id))?.status).toBe('ENVIADA');
  });

  it('remove do responsável um interesse retirado e registra o aviso uma única vez', async () => {
    const animal = createTestAnimal({ id: 'animal-meu', ownerId: 'dono', name: 'Pipoca' });
    const withdrawn = createTestInterest({
      id: 'interest-retirado',
      userId: 'interessado',
      animalId: animal.id,
    });
    await animals.saveLocal(animal);
    await localInterests.save(withdrawn);

    const pull = new PullRemoteInterestsUseCase(
      remote,
      localInterests,
      animals,
      queue,
      appState,
      { currentUserId: () => 'dono' }
    );

    await expect(pull.execute()).resolves.toMatchObject({ removed: 1, withdrawals: 1 });
    expect(await localInterests.findById(withdrawn.id)).toBeNull();

    const notices = JSON.parse((await appState.get('interest_withdrawals:dono')) ?? '[]');
    expect(notices).toEqual([
      expect.objectContaining({
        interestId: withdrawn.id,
        animalId: animal.id,
        animalName: 'Pipoca',
        interestedUserName: 'Usuário Teste',
      }),
    ]);

    await expect(pull.execute()).resolves.toMatchObject({ withdrawals: 0 });
    expect(JSON.parse((await appState.get('interest_withdrawals:dono')) ?? '[]')).toHaveLength(1);
  });
});
