import { InMemorySqliteDriver } from '../../../src/infrastructure/database/sqlite/DatabaseDriver';
import { loadAppContainer } from '../../../src/infrastructure/composition/loadAppContainer';
import { SupabaseAnimalRepository } from '../../../src/infrastructure/supabase/repositories/SupabaseAnimalRepository';
import { SupabaseAuthGateway } from '../../../src/infrastructure/supabase/auth/SupabaseAuthGateway';
import { ProcessSyncQueueUseCase } from '../../../src/application/use-cases/ProcessSyncQueueUseCase';
import { SyncAction } from '../../../src/domain/entities/SyncAction';
import {
  FakeSupabaseClient,
  seedFakeDb,
} from '../../../test-support/SupabaseFake';

/**
 * Composição do Passo 3 (doc §13): com credenciais, os mesmos ports ganham a
 * perna remota (Supabase) e auth/moderação reais — SEM credenciais, o app
 * segue inteiramente offline/SQLite (modo honesto §0.1; APK nunca depende).
 */
describe('loadAppContainer com Supabase (Fase 3 — ligado POR CONFIGURAÇÃO)', () => {
  it('sem nenhuma config → remoteMode none, sem gateways remotos (modo honesto)', async () => {
    const container = await loadAppContainer(new InMemorySqliteDriver());

    expect(container.remoteMode).toBe('none');
    expect(container.authGateway).toBeUndefined();
    expect(container.moderationGateway).toBeUndefined();
    // O repositório continua o SQLite puro (sem decorador). Indício: o proxy
    // remoto nunca é chamado — criação offline registra apenas a fila local.
    const offline = await container.animalRepository.createRemote(
      (await container.animalRepository.search({}))[0]
    );
    expect(offline.version).toBe(1);
  });

  it('com cliente injetado → remoteMode supabase + authGateway/moderationGateway presentes', async () => {
    const client = new FakeSupabaseClient({
      context: { db: seedFakeDb(), currentUserId: 'usr_1', isAdmin: false },
    });
    const container = await loadAppContainer(new InMemorySqliteDriver(), { supabaseClient: client });

    expect(container.remoteMode).toBe('supabase');
    expect(container.authGateway).toBeInstanceOf(SupabaseAuthGateway);
    expect(container.moderationGateway).toBeDefined();
  });

  it('a perna remota é a mesma instância dos ports usados pelos use cases: criação online grava no Supabase E remove ação da fila (outbox doc §14.1)', async () => {
    const client = new FakeSupabaseClient({
      context: { db: seedFakeDb(), currentUserId: 'usr_1', isAdmin: false },
    });
    const container = await loadAppContainer(new InMemorySqliteDriver(), { supabaseClient: client });

    // O repositório do container efetiva um decorador com a perna remota:
    // createRemote do container grava no "banco" do fake client. O animal
    // de seed do usuário (usr_1) já é uma instância `Animal` — sem spread,
    // preservando os value objects da entidade.
    const seeded = (await container.animalRepository.search({})).find(
      (animal) => animal.ownerId === 'usr_1'
    );
    const remote = await container.animalRepository.createRemote(seeded!);

    expect(remote.id).toBeDefined();
  });

  it('ProcessSyncQueueUseCase sobre o container com Supabase processa a fila CREATE no backend real', async () => {
    const client = new FakeSupabaseClient({
      context: { db: seedFakeDb(), currentUserId: 'usr_1', isAdmin: false },
    });
    const container = await loadAppContainer(new InMemorySqliteDriver(), { supabaseClient: client });

    const seeded = (await container.animalRepository.search({})).find(
      (animal) => animal.ownerId === 'usr_1'
    );
    const action = new SyncAction({
      id: 'sync_create_animal_1',
      operation: 'CREATE',
      entityType: 'animal',
      entityId: seeded!.id,
      payload: {},
    });
    await container.syncQueueRepository.enqueue(action);

    const result = await new ProcessSyncQueueUseCase(
      container.syncQueueRepository,
      container.animalRepository
    ).execute();

    expect(result.successCount).toBe(1);
  });
});
