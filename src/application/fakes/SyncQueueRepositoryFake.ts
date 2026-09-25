import { SyncAction } from '../../domain/entities/SyncAction';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';

export class SyncQueueRepositoryFake implements SyncQueueRepository {
  public queue: Map<string, SyncAction> = new Map();

  async enqueue(action: SyncAction): Promise<void> {
    this.queue.set(action.id, action);
  }

  async listPending(): Promise<SyncAction[]> {
    return Array.from(this.queue.values()).filter(
      (a) => a.status.isPending() || a.status.isFailed()
    );
  }

  async findById(id: string): Promise<SyncAction | null> {
    return this.queue.get(id) || null;
  }

  async update(action: SyncAction): Promise<void> {
    this.queue.set(action.id, action);
  }

  async delete(id: string): Promise<void> {
    this.queue.delete(id);
  }

  async clearCompleted(): Promise<void> {
    Array.from(this.queue.entries()).forEach(([id, action]) => {
      if (action.status.isCompleted()) {
        this.queue.delete(id);
      }
    });
  }
}
