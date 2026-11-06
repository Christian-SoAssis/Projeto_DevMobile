import { SyncAction } from '../../../src/domain/entities/SyncAction';
import { InMemorySqliteDriver } from '../../../src/infrastructure/database/sqlite/DatabaseDriver';
import { INITIAL_SCHEMA_SQL } from '../../../src/infrastructure/database/sqlite/migrations/schema.sql';
import { SqliteSyncQueueRepository } from '../../../src/infrastructure/database/sqlite/repositories/SqliteSyncQueueRepository';

describe('SqliteSyncQueueRepository', () => {
  let db: InMemorySqliteDriver;
  let repository: SqliteSyncQueueRepository;

  beforeEach(async () => {
    db = new InMemorySqliteDriver();
    await db.execAsync(INITIAL_SCHEMA_SQL);
    repository = new SqliteSyncQueueRepository(db);
  });

  it('enfileira ações e lista pendentes preservando payload e tentativas (RNF02/RNF09)', async () => {
    const action1 = new SyncAction({
      id: 'act_1',
      operation: 'CREATE',
      entityType: 'animal',
      entityId: 'a1',
      payload: { name: 'Rex', city: 'Varginha' },
    });
    const action2 = new SyncAction({
      id: 'act_2',
      operation: 'MARK_ADOPTED',
      entityType: 'animal',
      entityId: 'a2',
      payload: { requestorId: 'u1' },
    });

    await repository.enqueue(action1);
    await repository.enqueue(action2);

    const pending = await repository.listPending();
    expect(pending).toHaveLength(2);
    expect(pending[0].id).toBe('act_1');
    expect(pending[0].payload.name).toBe('Rex');
    expect(pending[1].id).toBe('act_2');
  });

  it('atualiza status e erros da ação de sincronização', async () => {
    const action = new SyncAction({
      id: 'act_1',
      operation: 'CREATE',
      entityType: 'animal',
      entityId: 'a1',
      payload: {},
    });
    await repository.enqueue(action);

    action.markFailed('Erro de conexão');
    await repository.update(action);

    const updated = await repository.findById('act_1');
    expect(updated?.attempts).toBe(1);
    expect(updated?.lastError).toBe('Erro de conexão');
    expect(updated?.status.isFailed()).toBe(true);
  });

  /**
   * OFF-07/T07: `enqueueAnimalUpdate` substitui UPDATEs/MARK_ADOPTED
   * pendentes do MESMO animal pela revisão nova. Regras do filtro SQL:
   * itens EM CONFLITO (`last_error [CONFLITO]%`, doc §9.4) e CREATE são
   * preservados; SYNCING não é tocado (não está em PENDING/FAILED).
   */
  it('enqueueAnimalUpdate: supersede preserva conflito e CREATE, remove UPDATEs pendentes do animal', async () => {
    const setup = (props: {
      id: string;
      operation: 'UPDATE' | 'MARK_ADOPTED' | 'CREATE';
      entityId: string;
      conflict?: boolean;
    }) => {
      const a = new SyncAction({
        id: props.id,
        operation: props.operation,
        entityType: 'animal',
        entityId: props.entityId,
        payload: { version: 2 },
      });
      if (props.conflict) a.markConflict('situação divergente pede revisão');
      repository.enqueue(a);
      return a;
    };

    setup({ id: 'sync_update_a1_v2', operation: 'UPDATE', entityId: 'a1' }); // supersede → via
    setup({ id: 'sync_adopted_a1', operation: 'MARK_ADOPTED', entityId: 'a1' }); // supersede → via
    setup({ id: 'sync_update_a3_v2_conflict', operation: 'UPDATE', entityId: 'a3', conflict: true }); // preservado
    setup({ id: 'sync_create_a1', operation: 'CREATE', entityId: 'a1' }); // preservado (pai)
    // UPDATE de OUTRO animal: não é superseded pela edição de a1.
    setup({ id: 'sync_update_a2_v1', operation: 'UPDATE', entityId: 'a2' });

    await repository.enqueueAnimalUpdate(
      new SyncAction({
        id: 'sync_update_a1_v3',
        operation: 'UPDATE',
        entityType: 'animal',
        entityId: 'a1',
        payload: { version: 3 },
      })
    );

    const ids = (await repository.listPending()).map((a) => a.id).sort();
    expect(ids).toEqual([
      'sync_create_a1',
      'sync_update_a1_v3',
      'sync_update_a2_v1',
      'sync_update_a3_v2_conflict',
    ]);
    const conflictPreserved = await repository.findById('sync_update_a3_v2_conflict');
    expect(conflictPreserved?.isConflict).toBe(true);
  });

  it('update: persiste o changed_at ATRÁS do momento da falha (backoff sobrevive a reinício)', async () => {
    const fixture = '2100-01-01T00:00:00.000Z'; // futuro de propósito
    const action = new SyncAction({
      id: 'act_changed_at',
      operation: 'UPDATE',
      entityType: 'animal',
      entityId: 'a1',
      payload: {},
      changedAt: fixture,
    });
    action.markSyncing();
    await repository.enqueue(action);
    // Falha AGORA: changedAt passa a ~Date.now() real — a espera do backoff
    // (OFF-05, ordem 7) conta do último insucesso, não do enfileiramento.
    action.markFailed('conexão instável');
    await repository.update(action);

    const reloaded = await repository.findById('act_changed_at');
    expect(reloaded?.changedAt).toBe(action.changedAt);
    expect(Date.parse(reloaded!.changedAt) >= Date.parse('2020-01-01T00:00:00.000Z')).toBe(true);
    expect(Date.parse(reloaded!.changedAt) < Date.parse(fixture)).toBe(true);
  });

  it('remove ação individual e limpa concluídas', async () => {    const act1 = new SyncAction({ id: 'act_1', operation: 'CREATE', entityType: 'animal', entityId: 'a1', payload: {} });
    const act2 = new SyncAction({ id: 'act_2', operation: 'UPDATE', entityType: 'animal', entityId: 'a2', payload: {} });

    await repository.enqueue(act1);
    await repository.enqueue(act2);

    act1.markCompleted();
    await repository.update(act1);

    await repository.clearCompleted();

    const remaining = await repository.listPending();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('act_2');
  });
});
