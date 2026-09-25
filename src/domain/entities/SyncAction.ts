import { SyncState } from '../value-objects/SyncState';

export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE' | 'MARK_ADOPTED' | 'UPLOAD_PHOTO';
export type SyncEntityType = 'animal' | 'photo' | 'favorite' | 'interest';

export interface SyncActionProps {
  id: string;
  operation: SyncOperation;
  entityType: SyncEntityType;
  entityId: string;
  payload: Record<string, unknown>;
  changedAt?: string;
  attempts?: number;
  status?: SyncState;
  lastError?: string;
}

export class SyncAction {
  readonly id: string;
  readonly operation: SyncOperation;
  readonly entityType: SyncEntityType;
  readonly entityId: string;
  readonly payload: Record<string, unknown>;
  readonly changedAt: string;
  private _attempts: number;
  private _status: SyncState;
  private _lastError?: string;

  constructor(props: SyncActionProps) {
    if (!props.id) throw new Error('ID da ação de sincronização é obrigatório.');
    if (!props.operation) throw new Error('Operação de sincronização é obrigatória.');
    if (!props.entityType) throw new Error('Tipo da entidade é obrigatório.');
    if (!props.entityId) throw new Error('ID da entidade é obrigatório.');

    this.id = props.id;
    this.operation = props.operation;
    this.entityType = props.entityType;
    this.entityId = props.entityId;
    this.payload = props.payload || {};
    this.changedAt = props.changedAt || new Date().toISOString();
    this._attempts = props.attempts || 0;
    this._status = props.status || SyncState.pending();
    this._lastError = props.lastError;
  }

  get attempts(): number {
    return this._attempts;
  }

  get status(): SyncState {
    return this._status;
  }

  get lastError(): string | undefined {
    return this._lastError;
  }

  markSyncing(): void {
    this._status = SyncState.syncing();
  }

  markCompleted(): void {
    this._status = SyncState.completed();
    this._lastError = undefined;
  }

  markFailed(error: string): void {
    this._attempts += 1;
    this._lastError = error;
    this._status = SyncState.failed();
  }

  canRetry(maxAttempts: number = 5): boolean {
    return this._attempts < maxAttempts;
  }

  resetForRetry(): void {
    if (this.canRetry()) {
      this._status = SyncState.pending();
    }
  }
}
