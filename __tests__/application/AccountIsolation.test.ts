import { Animal } from '../../src/domain/entities/Animal';
import { AnimalCharacteristics } from '../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../src/domain/value-objects/ApproximateLocation';
import { SyncAction } from '../../src/domain/entities/SyncAction';
import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { SyncQueueRepositoryFake } from '../../src/application/fakes/SyncQueueRepositoryFake';
import { ProcessSyncQueueUseCase } from '../../src/application/use-cases/ProcessSyncQueueUseCase';
import { DeleteAnimalUseCase } from '../../src/application/use-cases/DeleteAnimalUseCase';
import { CreateAnimalUseCase } from '../../src/application/use-cases/CreateAnimalUseCase';
import { SearchAnimalsUseCase } from '../../src/application/use-cases/SearchAnimalsUseCase';
import { FavoriteRemoteGateway } from '../../src/domain/ports/FavoriteRemoteGateway';
import {
  publishActiveUserId,
  resetActiveUserId,
  getActiveUserId,
  isVisibleToActiveSession,
} from '../../src/adapters/sync/activeSession';

/**
 * DAT-10 (ordens 0 e 2, cenário T19). Política decidida na ordem 0:
 * PRESERVAR e PAUSAR — trocar de conta no aparelho não apaga nada; o
 * worker só envia as ações da conta logada, e as de outra conta voltam a
 * subir quando o dono entrar de novo.
 */

function makeAnimal(id: string, ownerId: string): Animal {
  return new Animal({
    id,
    ownerId,
    name: 'Luna',
    characteristics: new AnimalCharacteristics({
      species: 'Cão',
      size: 'Pequeno',
      approximateAge: '2 anos',
      sex: 'Fêmea',
    }),
    location: new ApproximateLocation({
      latitude: -21.55,
      longitude: -45.44,
      neighborhood: 'Centro',
      city: 'Varginha',
      region: 'MG',
    }),
  });
}

class SpyAnimalRepo extends AnimalRepositoryFake {
  updatesRemotos: string[] = [];
  async updateRemote(animal: Animal): Promise<Animal> {
    this.updatesRemotos.push(animal.id);
    return animal;
  }
}

function updateAction(animalId: string, ownerId?: string): SyncAction {
  return new SyncAction({
    id: `sync_update_${animalId}`,
    operation: 'UPDATE',
    entityType: 'animal',
    entityId: animalId,
    payload: ownerId ? { ownerId, version: 2 } : { version: 2 },
  });
}

describe('DAT-10 — worker pausa ações de outra conta (ordem 2, T19)', () => {
  it('pendência de A não sobe sob a sessão de B e sobe quando A volta', async () => {
    const animais = new SpyAnimalRepo([makeAnimal('a1', 'usr_A')]);
    const fila = new SyncQueueRepositoryFake();
    await fila.enqueue(updateAction('a1', 'usr_A'));

    let sessao: string | null = 'usr_B';
    const worker = new ProcessSyncQueueUseCase(fila, animais, 5, undefined, {
      currentUserId: () => sessao,
    });

    const sobB = await worker.execute();
    expect(sobB.pausedCount).toBe(1);
    expect(sobB.processedCount).toBe(0);
    expect(animais.updatesRemotos).toEqual([]);
    // Intacta: sem tentativa contada, sem marca de falha.
    const preservada = await fila.findById('sync_update_a1');
    expect(preservada?.status.isPending()).toBe(true);
    expect(preservada?.attempts).toBe(0);
    expect(preservada?.lastError).toBeUndefined();

    sessao = 'usr_A';
    const sobA = await worker.execute();
    expect(sobA.successCount).toBe(1);
    expect(sobA.pausedCount).toBe(0);
    expect(animais.updatesRemotos).toEqual(['a1']);
  });

  it('sem ninguém logado, nenhuma ação com dono é enviada', async () => {
    const animais = new SpyAnimalRepo([makeAnimal('a1', 'usr_A')]);
    const fila = new SyncQueueRepositoryFake();
    await fila.enqueue(updateAction('a1', 'usr_A'));

    const worker = new ProcessSyncQueueUseCase(fila, animais, 5, undefined, {
      currentUserId: () => null,
    });

    const res = await worker.execute();
    expect(res.pausedCount).toBe(1);
    expect(animais.updatesRemotos).toEqual([]);
  });

  it('favorito de B (userId no payload) fica pausado sob A; o de A sobe', async () => {
    const enviados: string[] = [];
    const favoritos: FavoriteRemoteGateway = {
      addRemote: jest.fn(async (userId: string) => {
        enviados.push(userId);
      }),
      removeRemote: jest.fn(async () => undefined),
    } as unknown as FavoriteRemoteGateway;
    const fila = new SyncQueueRepositoryFake();
    for (const userId of ['usr_A', 'usr_B']) {
      await fila.enqueue(
        new SyncAction({
          id: `fav_${userId}`,
          operation: 'CREATE',
          entityType: 'favorite',
          entityId: `${userId}_a1`,
          payload: { userId, animalId: 'a1' },
        })
      );
    }

    const worker = new ProcessSyncQueueUseCase(fila, new AnimalRepositoryFake(), 5, undefined, {
      favorites: favoritos,
      currentUserId: () => 'usr_A',
    });
    const res = await worker.execute();

    expect(enviados).toEqual(['usr_A']);
    expect(res.pausedCount).toBe(1);
    expect((await fila.findById('fav_usr_B'))?.status.isPending()).toBe(true);
  });

  it('item legado sem dono no payload é atribuído pelo anúncio local', async () => {
    const animais = new SpyAnimalRepo([makeAnimal('a1', 'usr_A')]);
    const fila = new SyncQueueRepositoryFake();
    await fila.enqueue(updateAction('a1')); // enfileirado antes da ordem 2

    const worker = new ProcessSyncQueueUseCase(fila, animais, 5, undefined, {
      currentUserId: () => 'usr_B',
    });
    const res = await worker.execute();

    expect(res.pausedCount).toBe(1);
    expect(animais.updatesRemotos).toEqual([]);
  });

  it('sem provedor de sessão (legado/testes), nada é filtrado', async () => {
    const animais = new SpyAnimalRepo([makeAnimal('a1', 'usr_A')]);
    const fila = new SyncQueueRepositoryFake();
    await fila.enqueue(updateAction('a1', 'usr_A'));

    const res = await new ProcessSyncQueueUseCase(fila, animais).execute();
    expect(res.successCount).toBe(1);
    expect(res.pausedCount).toBe(0);
  });

  it('DELETE leva o dono no payload (o anúncio local some junto)', async () => {
    const animais = new AnimalRepositoryFake([makeAnimal('a1', 'usr_A')]);
    const fila = new SyncQueueRepositoryFake();
    await new DeleteAnimalUseCase(animais, fila).execute('usr_A', 'a1', false);

    const acao = await fila.findById('sync_delete_a1');
    expect(acao?.ownerId).toBe('usr_A');
  });
});

describe('DAT-10 — rascunho offline de A não aparece na busca de B (T19)', () => {
  async function cenario() {
    const animais = new AnimalRepositoryFake([makeAnimal('publicado', 'usr_A')]);
    const fila = new SyncQueueRepositoryFake();
    // A cria offline: o anúncio fica local com CREATE pendente.
    await new CreateAnimalUseCase(animais, fila).execute(makeAnimal('rascunho', 'usr_A'), false);
    return { animais, fila };
  }

  it('B não vê o rascunho de A; o anúncio já publicado continua visível', async () => {
    const { animais, fila } = await cenario();
    const busca = new SearchAnimalsUseCase(animais, { syncQueueRepository: fila, currentUserId: () => 'usr_B' });

    const ids = (await busca.execute({}, false)).animals.map((a) => a.id);
    expect(ids).toContain('publicado');
    expect(ids).not.toContain('rascunho');
    // Preservado: nada foi apagado.
    expect(await animais.findById('rascunho')).not.toBeNull();
    expect((await fila.listPending()).length).toBe(1);
  });

  it('A, ao voltar, vê o próprio rascunho', async () => {
    const { animais, fila } = await cenario();
    const busca = new SearchAnimalsUseCase(animais, { syncQueueRepository: fila, currentUserId: () => 'usr_A' });

    const ids = (await busca.execute({}, false)).animals.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['publicado', 'rascunho']));
  });
});

describe('activeSession — sessão vista pela sincronização (adapters)', () => {
  afterEach(() => resetActiveUserId());

  const de = (userId: string) =>
    new SyncAction({
      id: `x_${userId}`,
      operation: 'CREATE',
      entityType: 'favorite',
      entityId: 'e',
      payload: { userId },
    });

  it('sem AuthProvider (undefined) mostra tudo', () => {
    expect(getActiveUserId()).toBeUndefined();
    expect(isVisibleToActiveSession(de('usr_B'))).toBe(true);
  });

  it('esconde pendências de outra conta e mostra as próprias', () => {
    publishActiveUserId('usr_A');
    expect(isVisibleToActiveSession(de('usr_A'))).toBe(true);
    expect(isVisibleToActiveSession(de('usr_B'))).toBe(false);
  });

  it('deslogado (null) esconde toda pendência com dono', () => {
    publishActiveUserId(null);
    expect(isVisibleToActiveSession(de('usr_A'))).toBe(false);
  });
});
