import { loadAppContainer, AppContainer } from '../../../src/infrastructure/composition/loadAppContainer';
import { InMemorySqliteDriver } from '../../../src/infrastructure/database/sqlite/DatabaseDriver';
import { ImageProcessorFake } from '../../../src/application/fakes/ImageProcessorFake';
import { UpdateAnimalUseCase } from '../../../src/application/use-cases/UpdateAnimalUseCase';
import {
  ANIMALS_SYNC_KEY,
  PullRemoteAnimalsUseCase,
} from '../../../src/application/use-cases/PullRemoteAnimalsUseCase';
import { SupabaseAnimalRepository } from '../../../src/infrastructure/supabase/repositories/SupabaseAnimalRepository';
import { FakeSupabaseClient, FakeSupabaseDb, seedFakeDb } from '../../../test-support/SupabaseFake';

/**
 * OFF-06 — decisão da ordem 6: pull INCREMENTAL por cursor (keyset
 * `(updated_at, id)` do servidor) + tombstones para apagados/ocultados.
 * Backend simulado com relógio de servidor (`serverClock`), espelhando os
 * triggers do `supabase/init.sql`.
 */

const OWNER = '11111111-1111-4111-8111-111111111111';
const VISITOR = '22222222-2222-4222-8222-222222222222';
const id = (n: number) => `33333333-3333-4333-8333-${String(n).padStart(12, '0')}`;

/** Relógio do servidor: 1 ms por escrita, formato do PostgREST (6 casas, +00:00). */
function makeServerClock(start = Date.parse('2026-11-01T10:00:00.000Z')) {
  let t = start;
  return {
    tick: () => {
      t += 1;
      return new Date(t).toISOString().replace('Z', '000+00:00');
    },
    jump: (ms: number) => {
      t += ms;
    },
  };
}

function row(n: number, at: string, over: Record<string, unknown> = {}) {
  return {
    id: id(n),
    owner_id: OWNER,
    name: `Animal ${n}`,
    species: 'Cão',
    size: 'Pequeno',
    approximate_age: '2 anos',
    sex: 'Fêmea',
    description: null,
    health_notes: null,
    special_care: null,
    status: 'AVAILABLE',
    moderation_status: 'NONE',
    neighborhood: 'Centro',
    city: 'Varginha',
    region: 'MG',
    latitude: -21.55,
    longitude: -45.44,
    created_at: at,
    updated_at: at,
    version: 1,
    ...over,
  };
}

async function boot(userId: string | null, db: FakeSupabaseDb, clock: ReturnType<typeof makeServerClock>) {
  const context = { db, currentUserId: userId, isAdmin: false, serverClock: clock.tick };
  const client = new FakeSupabaseClient({ context });
  const container = await loadAppContainer(new InMemorySqliteDriver(), {
    supabaseClient: client,
    imageProcessor: new ImageProcessorFake(),
    readFile: async () => new Uint8Array([1]),
  });
  return { client, context, container };
}

/** Pull isolado, com página pequena para exercitar a paginação por keyset. */
function pullOf(
  container: AppContainer,
  _client: FakeSupabaseClient,
  opts: { pageSize?: number; currentUserId?: () => string | null } = {}
) {
  return new PullRemoteAnimalsUseCase(
    container.remoteAnimalSource!,
    container.animalRepository,
    container.syncQueueRepository,
    container.syncMetadataRepository,
    undefined,
    opts
  );
}

/** Espia quantas linhas o servidor devolveu (prova de que o delta não rebaixa tudo). */
function countServedRows(client: FakeSupabaseClient) {
  const served = { animals: 0 };
  const original = client.from.bind(client);
  (client as any).from = (table: string) => {
    const t: any = original(table);
    if (table !== 'animals') return t;
    const select = t.select.bind(t);
    t.select = (...args: unknown[]) => {
      const builder: any = select(...args);
      const then = builder.then.bind(builder);
      builder.then = (ok: any, ko: any) =>
        then((res: any) => {
          served.animals += res.data?.length ?? 0;
          return ok ? ok(res) : res;
        }, ko);
      return builder;
    };
    return t;
  };
  return served;
}

describe('OFF-06 — pull incremental por cursor (ordem 6)', () => {
  it('1ª sincronização baixa tudo em páginas; a 2ª só o que mudou', async () => {
    const clock = makeServerClock();
    const db = seedFakeDb({ animals: [1, 2, 3, 4, 5].map((n) => row(n, clock.tick())) });
    const { client, container } = await boot(VISITOR, db, clock);

    const first = await pullOf(container, client, { pageSize: 2 }).execute();
    expect(first).toMatchObject({ added: 5, updated: 0 });
    const meta = await container.syncMetadataRepository.findByKey(ANIMALS_SYNC_KEY);
    expect(JSON.parse(meta!.cursor!).animals.id).toBe(id(5)); // cursor = última linha (servidor)

    // Só o 3 muda no servidor (trigger regrava updated_at).
    clock.jump(5 * 60_000); // fora da janela de sobreposição
    db.animals[2] = { ...db.animals[2], name: 'Três editado', version: 2, updated_at: clock.tick() };

    const served = countServedRows(client);
    const second = await pullOf(container, client, { pageSize: 2 }).execute();
    expect(second).toMatchObject({ fetched: 1, added: 0, updated: 1 });
    expect(served.animals).toBe(1); // nada além do delta trafegou
    expect((await container.animalRepository.findById(id(3)))?.name).toBe('Três editado');
  });

  it('linhas com o MESMO carimbo não se perdem entre páginas (desempate por id)', async () => {
    const clock = makeServerClock();
    const same = clock.tick();
    const db = seedFakeDb({ animals: [1, 2, 3, 4, 5].map((n) => row(n, same)) });
    const { client, container } = await boot(VISITOR, db, clock);

    const res = await pullOf(container, client, { pageSize: 2 }).execute();

    expect(res.added).toBe(5);
    for (const n of [1, 2, 3, 4, 5]) {
      expect(await container.animalRepository.findById(id(n))).not.toBeNull();
    }
  });

  it('janela de sobreposição recolhe a linha confirmada com carimbo atrasado', async () => {
    const clock = makeServerClock();
    const db = seedFakeDb({ animals: [row(1, clock.tick())] });
    const { client, container } = await boot(VISITOR, db, clock);
    await pullOf(container, client).execute();

    // Transação longa: confirmou DEPOIS do pull, mas com carimbo 10 s ANTES do cursor.
    const late = new Date(Date.parse(db.animals[0].updated_at) - 10_000).toISOString();
    db.animals.push(row(2, late));

    const res = await pullOf(container, client).execute();
    expect(res.added).toBe(1);
    // A releitura do 1 (dentro da janela) é inofensiva: mesma versão, nada muda.
    expect(res.updated).toBe(0);
  });

  it('criação usa o relógio do SERVIDOR, não o do aparelho atrasado', async () => {
    const clock = makeServerClock();
    const db = seedFakeDb({ animals: [row(1, clock.tick())] });
    const { client, container } = await boot(OWNER, db, clock);
    await pullOf(container, client).execute();

    clock.jump(5 * 60_000);
    // App com relógio 1 dia atrasado manda updated_at antigo; trigger corrige.
    await client.from('animals').insert(row(2, '2026-10-31T10:00:00.000Z'));

    const res = await pullOf(container, client).execute();
    expect(res.added).toBe(1);
  });

  it('anúncio apagado no servidor sai do cache (tombstone DELETED)', async () => {
    const clock = makeServerClock();
    const db = seedFakeDb({ animals: [row(1, clock.tick()), row(2, clock.tick())] });
    const { client, context, container } = await boot(VISITOR, db, clock);
    await pullOf(container, client).execute();

    context.currentUserId = OWNER;
    await client.from('animals').delete().eq('id', id(1));
    context.currentUserId = VISITOR;

    const res = await pullOf(container, client).execute();
    expect(res.removed).toBe(1);
    expect(await container.animalRepository.findById(id(1))).toBeNull();
    expect(await container.animalRepository.findById(id(2))).not.toBeNull();
  });

  it('ocultado pela moderação sai do cache de terceiros, mas fica no do dono', async () => {
    const clock = makeServerClock();
    const db = seedFakeDb({ animals: [row(1, clock.tick())] });
    const visitante = await boot(VISITOR, db, clock);
    const dono = await boot(OWNER, db, clock);
    await pullOf(visitante.container, visitante.client).execute();
    await pullOf(dono.container, dono.client, { currentUserId: () => OWNER }).execute();

    visitante.context.isAdmin = true;
    await visitante.client.from('animals').update({ moderation_status: 'HIDDEN' }).eq('id', id(1));
    visitante.context.isAdmin = false;

    await pullOf(visitante.container, visitante.client, { currentUserId: () => VISITOR }).execute();
    await pullOf(dono.container, dono.client, { currentUserId: () => OWNER }).execute();

    expect(await visitante.container.animalRepository.findById(id(1))).toBeNull();
    expect(await dono.container.animalRepository.findById(id(1))).not.toBeNull();
  });

  it('reexibido pela moderação volta pelo delta', async () => {
    const clock = makeServerClock();
    const db = seedFakeDb({ animals: [row(1, clock.tick())] });
    const { client, context, container } = await boot(VISITOR, db, clock);
    await pullOf(container, client).execute();

    context.isAdmin = true;
    await client.from('animals').update({ moderation_status: 'HIDDEN' }).eq('id', id(1));
    context.isAdmin = false;
    await pullOf(container, client).execute();
    expect(await container.animalRepository.findById(id(1))).toBeNull();

    context.isAdmin = true;
    await client.from('animals').update({ moderation_status: 'NONE' }).eq('id', id(1));
    context.isAdmin = false;
    const res = await pullOf(container, client).execute();

    expect(res.added).toBe(1);
    expect(db.animal_tombstones).toEqual([]);
  });

  it('tombstone não remove anúncio com edição local pendente (sem perda silenciosa)', async () => {
    const clock = makeServerClock();
    const db = seedFakeDb({ animals: [row(1, clock.tick())] });
    const { client, context, container } = await boot(OWNER, db, clock);
    await pullOf(container, client).execute();

    const edit = new UpdateAnimalUseCase(container.animalRepository, container.syncQueueRepository, container.unitOfWork);
    await edit.execute(OWNER, id(1), { name: 'Edição offline' }, false);

    context.isAdmin = true;
    await client.from('animals').delete().eq('id', id(1));
    context.isAdmin = false;

    const res = await pullOf(container, client).execute();
    expect(res.skippedPending).toBe(1);
    expect((await container.animalRepository.findById(id(1)))?.name).toBe('Edição offline');
  });

  it('falha no meio do pull não avança o cursor', async () => {
    const clock = makeServerClock();
    const db = seedFakeDb({ animals: [row(1, clock.tick())] });
    const { client, container } = await boot(VISITOR, db, clock);
    await pullOf(container, client).execute();
    const before = (await container.syncMetadataRepository.findByKey(ANIMALS_SYNC_KEY))!.cursor;

    clock.jump(5 * 60_000);
    db.animals.push(row(2, clock.tick()));
    const original = client.from.bind(client);
    (client as any).from = (table: string) => {
      if (table === 'animal_tombstones') throw new Error('rede caiu');
      return original(table);
    };

    await expect(pullOf(container, client).execute()).rejects.toThrow('rede caiu');
    expect((await container.syncMetadataRepository.findByKey(ANIMALS_SYNC_KEY))!.cursor).toBe(before);
  });
});

describe('SupabaseAnimalRepository.keysetAfter', () => {
  it('gera o keyset PostgREST com valores entre aspas e carimbo cru', () => {
    expect(
      SupabaseAnimalRepository.keysetAfter('updated_at', 'id', {
        at: '2026-11-01T10:00:00.123456+00:00',
        id: 'abc',
      })
    ).toBe(
      'updated_at.gt."2026-11-01T10:00:00.123456+00:00",and(updated_at.eq."2026-11-01T10:00:00.123456+00:00",id.gt."abc")'
    );
  });
});
