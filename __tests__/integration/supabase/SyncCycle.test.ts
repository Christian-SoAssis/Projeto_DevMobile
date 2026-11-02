import { loadAppContainer, AppContainer } from '../../../src/infrastructure/composition/loadAppContainer';
import { InMemorySqliteDriver } from '../../../src/infrastructure/database/sqlite/DatabaseDriver';
import { getFullSync } from '../../../src/adapters/hooks/useFullSync';
import { ImageProcessorFake } from '../../../src/application/fakes/ImageProcessorFake';
import { ToggleFavoriteUseCase } from '../../../src/application/use-cases/ToggleFavoriteUseCase';
import { RegisterAdoptionInterestUseCase } from '../../../src/application/use-cases/RegisterAdoptionInterestUseCase';
import { UpdateAnimalUseCase } from '../../../src/application/use-cases/UpdateAnimalUseCase';
import { MarkAnimalAdoptedUseCase } from '../../../src/application/use-cases/MarkAnimalAdoptedUseCase';
import { ResolveConflictUseCase } from '../../../src/application/use-cases/ResolveConflictUseCase';
import { ANIMALS_SYNC_KEY } from '../../../src/application/use-cases/PullRemoteAnimalsUseCase';
import { FakeSupabaseClient, FakeSupabaseDb, seedFakeDb } from '../../../test-support/SupabaseFake';
import { newUuid } from '../../../src/domain/services/IdGenerator';

const OWNER = '11111111-1111-4111-8111-111111111111';
const VISITOR = '22222222-2222-4222-8222-222222222222';
const ANIMAL = '33333333-3333-4333-8333-333333333333';

function row(over: Record<string, unknown> = {}) {
  return {
    id: ANIMAL,
    owner_id: OWNER,
    name: 'Luna',
    species: 'Cão',
    size: 'Pequeno',
    approximate_age: '2 anos',
    sex: 'Fêmea',
    description: 'Dócil',
    health_notes: null,
    special_care: null,
    status: 'AVAILABLE',
    moderation_status: 'NONE',
    neighborhood: 'Centro',
    city: 'Varginha',
    region: 'MG',
    latitude: -21.55,
    longitude: -45.44,
    created_at: '2026-11-01T10:00:00.000Z',
    updated_at: '2026-11-01T10:00:00.000Z',
    version: 1,
    ...over,
  };
}

async function boot(userId: string | null, db: FakeSupabaseDb) {
  const client = new FakeSupabaseClient({ context: { db, currentUserId: userId, isAdmin: false } });
  const container = await loadAppContainer(new InMemorySqliteDriver(), {
    supabaseClient: client,
    imageProcessor: new ImageProcessorFake(),
    readFile: async () => new Uint8Array([1]),
  });
  return { client, container };
}

const sync = (c: AppContainer) => getFullSync(c).execute();

describe('Passo 5 — pull do servidor (doc §14.1)', () => {
  it('traz anúncios de outras pessoas com fotos e grava last_sync_at', async () => {
    const db = seedFakeDb({
      users: [],
      animals: [row(), row({ id: newUuid(), name: 'Escondido', moderation_status: 'HIDDEN' })],
      animal_photos: [
        { id: newUuid(), animal_id: ANIMAL, remote_url: 'https://cdn/x.webp', is_main: true, created_at: '2026-11-01T10:00:00.000Z' },
      ],
    });
    const { container } = await boot(VISITOR, db);

    const result = await sync(container);

    expect(result.pull).toMatchObject({ fetched: 1, added: 1, updated: 0, skippedPending: 0 });
    const local = await container.animalRepository.findById(ANIMAL);
    expect(local?.name).toBe('Luna');
    expect(local?.photos[0].remoteUrl).toBe('https://cdn/x.webp');
    const meta = await container.syncMetadataRepository.findByKey(ANIMALS_SYNC_KEY);
    expect(meta?.lastSuccessAt).toBeDefined();
  });

  it('atualiza o cache quando o servidor tem versão mais nova e não mexe em anúncio com edição pendente', async () => {
    const db = seedFakeDb({ users: [], animals: [row()] });
    const { container } = await boot(OWNER, db);
    await sync(container);

    // Servidor avança; localmente nada pendente → cache é atualizado.
    db.animals[0] = row({ name: 'Luna Nova', version: 2, updated_at: '2026-11-02T10:00:00.000Z' });
    const updated = await sync(container);
    expect(updated.pull).toMatchObject({ updated: 1 });
    expect((await container.animalRepository.findById(ANIMAL))?.name).toBe('Luna Nova');

    // Edição local pendente (offline) → servidor não sobrescreve.
    const edit = new UpdateAnimalUseCase(container.animalRepository, container.syncQueueRepository, container.unitOfWork);
    await edit.execute(OWNER, ANIMAL, { name: 'Edição local' }, false);
    db.animals[0] = row({ name: 'Outra', version: 9, updated_at: '2026-11-03T10:00:00.000Z' });
    const result = await container.syncQueueRepository.listPending();
    expect(result).toHaveLength(1);
    const pull = await getFullSync(container).execute();
    // A fila sobe primeiro; a versão 9 do servidor gera conflito/resolução, nunca perda silenciosa.
    expect(pull.push.processedCount).toBe(1);
  });

  it('falha ao ler o servidor não derruba o envio da fila', async () => {
    const { container, client } = await boot(OWNER, seedFakeDb({ users: [], animals: [] }));
    const original = client.from.bind(client);
    (client as unknown as { from: unknown }).from = (table: string) => {
      if (table === 'animals') {
        return { select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: null, error: { message: 'boom' } }) }) }) }) };
      }
      return original(table);
    };
    const result = await sync(container);
    expect(result.pullError).toContain('Falha ao ler anúncios do servidor');
    expect(result.push).toBeDefined();
  });
});

describe('Passo 5 — favoritos e interesses na fila', () => {
  it('favoritar offline enfileira; a sync grava no servidor; desfavoritar remove', async () => {
    const db = seedFakeDb({ users: [], animals: [row()] });
    const { container } = await boot(VISITOR, db);
    await sync(container);

    const toggle = new ToggleFavoriteUseCase(container.favoriteRepository, container.syncQueueRepository, container.unitOfWork);
    expect(await toggle.execute(VISITOR, ANIMAL)).toBe(true);
    expect(await container.syncQueueRepository.listPending()).toHaveLength(1);

    await sync(container);
    expect(db['favorites']).toEqual([expect.objectContaining({ user_id: VISITOR, animal_id: ANIMAL })]);

    expect(await toggle.execute(VISITOR, ANIMAL)).toBe(false);
    await sync(container);
    expect(db['favorites']).toHaveLength(0);
  });

  it('favoritar e desfavoritar antes de sincronizar se anulam (nada vai ao servidor)', async () => {
    const db = seedFakeDb({ users: [], animals: [row()] });
    const { container } = await boot(VISITOR, db);
    const toggle = new ToggleFavoriteUseCase(container.favoriteRepository, container.syncQueueRepository, container.unitOfWork);
    await toggle.execute(VISITOR, ANIMAL);
    await toggle.execute(VISITOR, ANIMAL);
    expect(await container.syncQueueRepository.listPending()).toHaveLength(0);
  });

  it('anúncio de demonstração (id não-UUID) não entra na fila', async () => {
    const { container } = await boot(VISITOR, seedFakeDb({ users: [], animals: [] }));
    const toggle = new ToggleFavoriteUseCase(container.favoriteRepository, container.syncQueueRepository, container.unitOfWork);
    await toggle.execute(VISITOR, 'anim_1');
    expect(await container.syncQueueRepository.listPending()).toHaveLength(0);
  });

  it('favorito já existente no servidor é idempotente (não vira falha)', async () => {
    const db = seedFakeDb({ users: [], animals: [row()] });
    db['favorites'] = [{ user_id: VISITOR, animal_id: ANIMAL }];
    const { container } = await boot(VISITOR, db);
    const toggle = new ToggleFavoriteUseCase(container.favoriteRepository, container.syncQueueRepository, container.unitOfWork);
    await toggle.execute(VISITOR, ANIMAL);
    const result = await sync(container);
    expect(result.push).toMatchObject({ successCount: 1, failedCount: 0 });
    expect(db['favorites']).toHaveLength(1);
  });

  it('interesse sobe com o contato; só o responsável lê os recebidos', async () => {
    const db = seedFakeDb({ users: [], animals: [row()] });
    const visitor = await boot(VISITOR, db);
    await sync(visitor.container);

    const register = new RegisterAdoptionInterestUseCase(
      visitor.container.interestRepository,
      visitor.container.syncQueueRepository,
      visitor.container.unitOfWork
    );
    await register.execute(VISITOR, ANIMAL, { name: 'Bia', email: 'bia@x.com', phone: '35999' });
    await sync(visitor.container);
    expect(db['adoption_interests']).toEqual([
      expect.objectContaining({ user_id: VISITOR, animal_id: ANIMAL, contact_name: 'Bia', contact_phone: '35999' }),
    ]);

    const owner = await boot(OWNER, db);
    const received = await owner.container.remoteInterests!.listForAnimal(ANIMAL);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ contactName: 'Bia', contactEmail: 'bia@x.com' });

    const stranger = await boot('44444444-4444-4444-8444-444444444444', db);
    expect(await stranger.container.remoteInterests!.listForAnimal(ANIMAL)).toHaveLength(0);
  });
});

describe('Passo 5 — conflitos (doc §9.4, RF23)', () => {
  async function ownerWithAnimal(db: FakeSupabaseDb) {
    const ctx = await boot(OWNER, db);
    await sync(ctx.container); // cache local = versão 1 do servidor
    return ctx;
  }

  it('conflito simples (mesma situação): vence a versão mais recente, sem perguntar', async () => {
    const db = seedFakeDb({ users: [], animals: [row()] });
    const { container } = await ownerWithAnimal(db);

    // Edição local (v2) enquanto o servidor também avançou (v2, mais antiga).
    const edit = new UpdateAnimalUseCase(container.animalRepository, container.syncQueueRepository, container.unitOfWork);
    await edit.execute(OWNER, ANIMAL, { name: 'Local' }, false);
    db.animals[0] = row({ name: 'Servidor', version: 2, updated_at: '2026-11-01T10:30:00.000Z' });

    const result = await getFullSync(container).execute();

    expect(result.push).toMatchObject({ successCount: 1, conflictCount: 0 });
    expect(db.animals[0].name).toBe('Local'); // a edição local é a mais recente
    expect(db.animals[0].version).toBe(3);
  });

  it('conflito com risco (situação diverge): vira revisão e NÃO é reenviado sozinho', async () => {
    const db = seedFakeDb({ users: [], animals: [row()] });
    const { container } = await ownerWithAnimal(db);

    const adopt = new MarkAnimalAdoptedUseCase(container.animalRepository, container.syncQueueRepository, container.unitOfWork);
    await adopt.execute(OWNER, ANIMAL, false);
    db.animals[0] = row({ name: 'Editado no servidor', version: 2, updated_at: '2026-11-02T10:00:00.000Z' });

    const first = await getFullSync(container).execute();
    expect(first.push).toMatchObject({ successCount: 0, conflictCount: 1 });
    expect(db.animals[0].status).toBe('AVAILABLE'); // nada foi sobrescrito

    const again = await getFullSync(container).execute();
    expect(again.push.conflictCount).toBe(1); // continua parado, sem retry automático
    expect(again.push.failedCount).toBe(0);
  });

  it('revisão: "manter minha edição" reenvia e vence; "usar servidor" descarta a local', async () => {
    const db = seedFakeDb({ users: [], animals: [row()] });
    const { container } = await ownerWithAnimal(db);
    const adopt = new MarkAnimalAdoptedUseCase(container.animalRepository, container.syncQueueRepository, container.unitOfWork);
    await adopt.execute(OWNER, ANIMAL, false);
    db.animals[0] = row({ name: 'Servidor', version: 2, updated_at: '2026-11-02T10:00:00.000Z' });
    await getFullSync(container).execute();

    const resolver = new ResolveConflictUseCase(container.animalRepository, container.remoteAnimalSource!, container.syncQueueRepository);
    const [view] = await resolver.listConflicts();
    expect(view.local?.status.value).toBe('ADOPTED');
    expect(view.remote?.name).toBe('Servidor');

    await resolver.keepLocal(view.action.id);
    const sent = await getFullSync(container).execute();
    expect(sent.push).toMatchObject({ successCount: 1, conflictCount: 0 });
    expect(db.animals[0].status).toBe('ADOPTED');

    await expect(resolver.keepLocal(view.action.id)).rejects.toThrow('já foi resolvido');
  });

  it('revisão: "usar servidor" aplica a versão remota e limpa a fila', async () => {
    const db = seedFakeDb({ users: [], animals: [row()] });
    const { container } = await ownerWithAnimal(db);
    const adopt = new MarkAnimalAdoptedUseCase(container.animalRepository, container.syncQueueRepository, container.unitOfWork);
    await adopt.execute(OWNER, ANIMAL, false);
    db.animals[0] = row({ name: 'Servidor', version: 2, updated_at: '2026-11-02T10:00:00.000Z' });
    await getFullSync(container).execute();

    const resolver = new ResolveConflictUseCase(container.animalRepository, container.remoteAnimalSource!, container.syncQueueRepository);
    const [view] = await resolver.listConflicts();
    await resolver.useRemote(view.action.id);

    expect((await container.animalRepository.findById(ANIMAL))?.status.value).toBe('AVAILABLE');
    expect(await container.syncQueueRepository.listPending()).toHaveLength(0);
  });

  it('anúncio apagado no servidor: revisão oferece recriar ou descartar', async () => {
    const db = seedFakeDb({ users: [], animals: [row()] });
    const { container } = await ownerWithAnimal(db);
    const edit = new UpdateAnimalUseCase(container.animalRepository, container.syncQueueRepository, container.unitOfWork);
    await edit.execute(OWNER, ANIMAL, { name: 'Local' }, false);
    db.animals.length = 0; // removido no servidor

    const first = await getFullSync(container).execute();
    expect(first.push.conflictCount).toBe(1);

    const resolver = new ResolveConflictUseCase(container.animalRepository, container.remoteAnimalSource!, container.syncQueueRepository);
    const [view] = await resolver.listConflicts();
    expect(view.remote).toBeNull();
    await resolver.keepLocal(view.action.id); // recria
    const recreated = await getFullSync(container).execute();
    expect(recreated.push.successCount).toBe(1);
    expect(db.animals).toHaveLength(1);

    // E descartar: apaga a cópia local.
    const { container: c2 } = await ownerWithAnimal(seedFakeDb({ users: [], animals: [row()] }));
    const db2 = (c2.remoteAnimalSource as unknown as { client: { ctx: { db: FakeSupabaseDb } } }).client.ctx.db;
    await new UpdateAnimalUseCase(c2.animalRepository, c2.syncQueueRepository, c2.unitOfWork).execute(OWNER, ANIMAL, { name: 'X' }, false);
    db2.animals.length = 0;
    await getFullSync(c2).execute();
    const r2 = new ResolveConflictUseCase(c2.animalRepository, c2.remoteAnimalSource!, c2.syncQueueRepository);
    const [v2] = await r2.listConflicts();
    await r2.useRemote(v2.action.id);
    expect(await c2.animalRepository.findById(ANIMAL)).toBeNull();
  });
});
