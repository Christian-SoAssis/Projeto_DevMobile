import { Animal } from '../../src/domain/entities/Animal';
import { SyncAction } from '../../src/domain/entities/SyncAction';
import { AnimalCharacteristics } from '../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../src/domain/value-objects/ApproximateLocation';
import { SyncState } from '../../src/domain/value-objects/SyncState';
import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { SyncQueueRepositoryFake } from '../../src/application/fakes/SyncQueueRepositoryFake';
import { UpdateAnimalUseCase } from '../../src/application/use-cases/UpdateAnimalUseCase';
import { MarkAnimalAdoptedUseCase } from '../../src/application/use-cases/MarkAnimalAdoptedUseCase';

/**
 * OFF-07/DAT-09 (cenário T07 do checklist de arquitetura): a revisão 1
 * pendente de envio e o usuário cria a revisão 2 → confirmar a revisão 1
 * NÃO pode marcar a revisão 2 como enviada. Correção escolhida: a segunda
 * edição SUBSTITUI a pendência anterior (supersede) — a fila mantém uma
 * única revisão por animal, e o worker confirma o que envia de verdade.
 *
 * Item EM CONFLITO é preservado: aguarda revisão manual e não pode ser
 * descartado silenciosamente por uma nova edição (doc §9.4).
 */

const OWNER = 'usr_1';
const rijAcoes = (q: SyncQueueRepositoryFake) => Array.from(q.queue.values());

function makeAnimal(version = 1): Animal {
  return new Animal({
    id: 'a1',
    ownerId: OWNER,
    name: `Luna v${version}`,
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
    version,
  });
}

describe('Edição em fila — supersede da revisão pendente (T07)', () => {
  it('segunda edição substitui a UPDATE pendente anterior — fila tem UMA revisão por animal', async () => {
    const animalRepo = new AnimalRepositoryFake([makeAnimal(1)]);
    const queue = new SyncQueueRepositoryFake();
    const useCase = new UpdateAnimalUseCase(animalRepo, queue);

    await useCase.execute(OWNER, 'a1', { name: 'Luna v2' }, false); // offline → v2 fica pendente
    expect((await queue.listPending()).length).toBe(1);

    await useCase.execute(OWNER, 'a1', { name: 'Luna v3' }, false); // offline → v3

    const pendentes = await queue.listPending();
    expect(pendentes).toHaveLength(1);
    expect(pendentes[0].id).toBe('sync_update_a1_v3');
    expect(pendentes[0].payload.version).toBe(3);
    const acabou = rijAcoes(queue).filter((a) => a.id === 'sync_update_a1_v2');
    expect(acabou).toHaveLength(0); // v2 sai da fila: seu conteúdo está embutido em v3
  });

  it('marcar adotado substitui a UPDATE pendente anterior (...a fila fica com um único estado do animal)', async () => {
    const animalRepo = new AnimalRepositoryFake([makeAnimal(1)]);
    const queue = new SyncQueueRepositoryFake();
    const update = new UpdateAnimalUseCase(animalRepo, queue);
    const adotar = new MarkAnimalAdoptedUseCase(animalRepo, queue);

    await update.execute(OWNER, 'a1', { name: 'Luna v2' }, false);
    await adotar.execute(OWNER, 'a1', false);

    const pendentes = await queue.listPending();
    expect(pendentes).toHaveLength(1);
    expect(pendentes[0].operation).toBe('MARK_ADOPTED');
  });

  it('item EM CONFLITO é preservado pela nova edição (aguarda revisão manual, doc §9.4)', async () => {
    // A edição local v2 gerou a ação em conflito; o local está na v2 e a
    // próxima edição avança para a v3 (id distinto — sem colisão).
    const animalRepo = new AnimalRepositoryFake([makeAnimal(2)]);
    const queue = new SyncQueueRepositoryFake();
    queue.queue.set('sync_update_a1_v2', new SyncAction({
      id: 'sync_update_a1_v2',
      operation: 'UPDATE',
      entityType: 'animal',
      entityId: 'a1',
      payload: { name: 'Luna v2', version: 2 },
      status: SyncState.failed(),
      lastError: '[CONFLITO] situação divergente pede revisão',
    }));

    const useCase = new UpdateAnimalUseCase(animalRepo, queue);
    await useCase.execute(OWNER, 'a1', { name: 'Luna v3' }, false);

    const pendentes = await queue.listPending();
    expect(pendentes.map((a) => a.id)).toEqual(
      expect.arrayContaining(['sync_update_a1_v2', 'sync_update_a1_v3'])
    );
    expect(pendentes.find((a) => a.id === 'sync_update_a1_v2')?.isConflict).toBe(true);
  });

  it('CREATE pendente NÃO é substituído (o pai precisa subir; ordem CREATE → UPDATE mantém)', async () => {
    const animalRepo = new AnimalRepositoryFake([makeAnimal(1)]);
    const queue = new SyncQueueRepositoryFake();
    queue.queue.set('sync_create_a1', new SyncAction({
      id: 'sync_create_a1',
      operation: 'CREATE',
      entityType: 'animal',
      entityId: 'a1',
      payload: {},
    }));

    const useCase = new UpdateAnimalUseCase(animalRepo, queue);
    await useCase.execute(OWNER, 'a1', { name: 'Luna v2' }, false);

    const pendentes = await queue.listPending();
    expect(pendentes).toHaveLength(2); // CREATE preservado + a UPDATE nova (v2)
    expect(pendentes.map((a) => a.operation)).toEqual(
      expect.arrayContaining(['CREATE', 'UPDATE'])
    );
  });
});
