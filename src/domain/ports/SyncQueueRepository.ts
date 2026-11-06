import { SyncAction } from '../entities/SyncAction';

export interface SyncQueueRepository {
  enqueue(action: SyncAction): Promise<void>;
  /**
   * Enfileira a edição mais recente de um animal substituindo pendências
   * anteriores de `UPDATE`/`MARK_ADOPTED` do mesmo animal (OFF-07, cenário
   * T07: confirmar somente a revisão efetivamente enviada). Itens EM
   * CONFLITO são preservados — aguardam revisão manual (doc §9.4) e não
   * podem ser descartados por uma nova edição. Ações `SYNCING` (em envio)
   * não são tocadas. `CREATE` nunca é substituído (o pai precisa subir).
   */
  enqueueAnimalUpdate(action: SyncAction): Promise<void>;
  listPending(): Promise<SyncAction[]>;
  findById(id: string): Promise<SyncAction | null>;
  update(action: SyncAction): Promise<void>;
  delete(id: string): Promise<void>;
  clearCompleted(): Promise<void>;
}
