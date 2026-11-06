import { AppContainer } from '../../src/infrastructure/composition/loadAppContainer';
import { getFullSync } from '../../src/adapters/hooks/useFullSync';
import { onPullCompleted, notifyPullCompleted } from '../../src/adapters/sync/pullEvents';
import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { SyncQueueRepositoryFake } from '../../src/application/fakes/SyncQueueRepositoryFake';
import { Animal } from '../../src/domain/entities/Animal';
import { AnimalCharacteristics } from '../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../src/domain/value-objects/ApproximateLocation';

/**
 * OFF-02 (ordem 4 — re-consulta de listas após pull, checklist T28): o
 * cache local muda quando o pull do servidor completa, mas a tela que já
 * está aberta não sabe disso. Um evento leve na camada de adapters (a
 * aplicação permanece pura) avisa as telas para refazerem a última
 * consulta — o anúncio criado por outra pessoa aparece sem o usuário
 * precisar sair e voltar da tela.
 */

function makeAnimal(id: string, name: string): Animal {
  return new Animal({
    id,
    ownerId: 'usr_1',
    name,
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

let subscribed: Array<() => void> = [];
afterEach(() => {
  subscribed.forEach((off) => off());
  subscribed = [];
});

describe('pullEvents (ordem 4 — evento de pull concluído)', () => {
  it('getFullSync notifica o evento quando o pull do servidor completa (T28)', async () => {
    const animais = new AnimalRepositoryFake();
    const source = {
      listVisibleChangedAfter: jest.fn(async () => ({
        animals: [makeAnimal('a2', 'Bob')],
        next: { at: '2026-01-01T00:00:00.000Z', id: 'a2' },
      })),
      listRemovedAfter: jest.fn(async () => ({ removals: [], next: null })),
      findRemoteById: jest.fn(async () => null),
    };
    const container = {
      animalRepository: animais,
      syncQueueRepository: new SyncQueueRepositoryFake(),
      remoteAnimalSource: source,
    } as unknown as AppContainer;

    let notified = 0;
    subscribed.push(onPullCompleted(() => { notified += 1; }));

    await getFullSync(container).execute();

    expect(notified).toBe(1); // pull concluiu → telas podem re-consultar
    expect(await animais.findById('a2')).not.toBeNull(); // pull de verdade rodou
  });

  it('pull que falhou não notifica (nada mudou no cache)', async () => {
    const container = {
      animalRepository: new AnimalRepositoryFake(),
      syncQueueRepository: new SyncQueueRepositoryFake(),
      remoteAnimalSource: {
        listVisibleChangedAfter: jest.fn(async () => {
          throw new Error('sem rede');
        }),
        listRemovedAfter: jest.fn(async () => ({ removals: [], next: null })),
        findRemoteById: jest.fn(async () => null),
      },
    } as unknown as AppContainer;

    let notified = 0;
    subscribed.push(onPullCompleted(() => { notified += 1; }));

    await getFullSync(container).execute();

    expect(notified).toBe(0);
  });

  it('sem backend remoto (modo honesto) não há pull e não notifica', async () => {
    const container = {
      animalRepository: new AnimalRepositoryFake(),
      syncQueueRepository: new SyncQueueRepositoryFake(),
    } as unknown as AppContainer;

    let notified = 0;
    subscribed.push(onPullCompleted(() => { notified += 1; }));

    await getFullSync(container).execute();

    expect(notified).toBe(0);
  });

  it('notifyPullCompleted avisa todos os ouvintes e o unsubscribe os remove', () => {
    let a = 0;
    let b = 0;
    const offA = onPullCompleted(() => { a += 1; });
    subscribed.push(onPullCompleted(() => { b += 1; }));
    subscribed.push(offA);

    notifyPullCompleted();
    offA(); // desinscreve
    notifyPullCompleted();

    expect(a).toBe(1);
    expect(b).toBe(2);
  });
});
