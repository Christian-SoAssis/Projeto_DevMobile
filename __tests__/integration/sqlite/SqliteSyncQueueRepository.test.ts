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

  it('remove ação individual e limpa concluídas', async () => {
    const act1 = new SyncAction({ id: 'act_1', operation: 'CREATE', entityType: 'animal', entityId: 'a1', payload: {} });
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
