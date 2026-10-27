import { AuthGatewayFake } from '../../src/application/fakes/AuthGatewayFake';
import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { SyncQueueRepositoryFake } from '../../src/application/fakes/SyncQueueRepositoryFake';
import { DeleteAnimalUseCase } from '../../src/application/use-cases/DeleteAnimalUseCase';
import { ProcessSyncQueueUseCase } from '../../src/application/use-cases/ProcessSyncQueueUseCase';
import { SyncAction } from '../../src/domain/entities/SyncAction';
import { Animal } from '../../src/domain/entities/Animal';
import { AnimalCharacteristics } from '../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../src/domain/value-objects/ApproximateLocation';

function buildAnimal(id = 'a1', ownerId = 'u1'): Animal {
  return new Animal({
    id,
    ownerId,
    name: 'Rex',
    characteristics: new AnimalCharacteristics({
      species: 'Cão',
      size: 'Médio',
      approximateAge: '2 anos',
      sex: 'Macho',
    }),
    location: new ApproximateLocation({
      latitude: -21.55,
      longitude: -45.43,
      neighborhood: 'Centro',
      city: 'Varginha',
      region: 'MG',
    }),
  });
}

describe('AuthGatewayFake — cadastro, senha e token', () => {
  it('deve cadastrar usuário e permitir login apenas com a senha cadastrada', async () => {
    const gateway = new AuthGatewayFake();
    const user = await gateway.register({ name: 'Maria', email: 'maria@exemplo.com', password: 'segredo' });

    await expect(gateway.login('maria@exemplo.com', 'outra')).rejects.toThrow('Credenciais inválidas.');
    const session = await gateway.login('MARIA@exemplo.com', 'segredo');
    expect(session.user.id).toBe(user.id);
  });

  it('deve rejeitar cadastro com e-mail já existente', async () => {
    const gateway = new AuthGatewayFake();
    await expect(
      gateway.register({ name: 'Outra Ana', email: 'ana@exemplo.com', password: 'x' })
    ).rejects.toThrow('E-mail já cadastrado (mock).');
  });

  it('deve restaurar a sessão com o usuário dono do token', async () => {
    const gateway = new AuthGatewayFake();
    const { token } = await gateway.login('carlos@exemplo.com', 'qualquer');
    const restored = await gateway.acessarViaToken(token);
    expect(restored.user.id).toBe('usr_2');
  });
});

describe('DeleteAnimalUseCase — exclusão offline', () => {
  it('deve remover do cache local e enfileirar a exclusão remota', async () => {
    const animalRepo = new AnimalRepositoryFake([buildAnimal()]);
    const queueRepo = new SyncQueueRepositoryFake();

    await new DeleteAnimalUseCase(animalRepo, queueRepo).execute('u1', 'a1', false);

    expect(await animalRepo.findById('a1')).toBeNull();
    expect(await animalRepo.listByOwner('u1')).toHaveLength(0);
    const pending = await queueRepo.listPending();
    expect(pending.map((a) => a.operation)).toEqual(['DELETE']);
  });
});

describe('ProcessSyncQueueUseCase — operações e perda silenciosa', () => {
  it('deve usar createRemote para itens CREATE', async () => {
    const animalRepo = new AnimalRepositoryFake([buildAnimal()]);
    const queueRepo = new SyncQueueRepositoryFake();
    const createSpy = jest.spyOn(animalRepo, 'createRemote');
    const updateSpy = jest.spyOn(animalRepo, 'updateRemote');
    await queueRepo.enqueue(
      new SyncAction({ id: 's1', operation: 'CREATE', entityType: 'animal', entityId: 'a1', payload: {} })
    );

    const res = await new ProcessSyncQueueUseCase(queueRepo, animalRepo).execute();

    expect(res.successCount).toBe(1);
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('deve manter na fila como falha quando o registro local não existe', async () => {
    const animalRepo = new AnimalRepositoryFake();
    const queueRepo = new SyncQueueRepositoryFake();
    await queueRepo.enqueue(
      new SyncAction({ id: 's2', operation: 'UPDATE', entityType: 'animal', entityId: 'sumido', payload: {} })
    );

    const res = await new ProcessSyncQueueUseCase(queueRepo, animalRepo).execute();

    expect(res.failedCount).toBe(1);
    const item = await queueRepo.findById('s2');
    expect(item?.status.isFailed()).toBe(true);
    expect(item?.lastError).toBe('Registro local do anúncio não encontrado para sincronizar.');
  });
});
