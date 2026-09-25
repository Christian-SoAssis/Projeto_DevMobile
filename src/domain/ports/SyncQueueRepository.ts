import { SyncAction } from '../entities/SyncAction';

export interface SyncQueueRepository {
  enqueue(action: SyncAction): Promise<void>;
  listPending(): Promise<SyncAction[]>;
  findById(id: string): Promise<SyncAction | null>;
  update(action: SyncAction): Promise<void>;
  delete(id: string): Promise<void>;
  clearCompleted(): Promise<void>;
}
