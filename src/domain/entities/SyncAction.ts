import { SyncState, SyncStateType } from '../value-objects/SyncState';
import { generateUuid } from '../services/IdGenerator';

export type SyncOperationType =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'MARK_ADOPTED'
  | 'UPLOAD_PHOTO';

export type SyncEntityType = 'animal' | 'photo' | 'favorite' | 'interest';

export interface SyncActionProps {
  id?: string;
  operation: SyncOperationType;
  entityType: SyncEntityType;
  entityId: string;
  payload: Record<string, unknown>;
  changedAt?: string;
  attempts?: number;
  status?: SyncState | SyncStateType;
  lastError?: string;
}

/**
 * Agregado técnico local para a fila outbox offline-first (§14.2, RNF02, RNF08).
 */
export class SyncAction {
  public readonly id: string;
  public readonly operation: SyncOperationType;
  public readonly entityType: SyncEntityType;
  public readonly entityId: string;
  public readonly payload: Record<string, unknown>;
  public readonly changedAt: string;
  private _attempts: number;
  private _status: SyncState;
  private _lastError?: string;

  constructor(props: SyncActionProps) {
    this.id = props.id ?? generateUuid();
    this.operation = props.operation;
    this.entityType = props.entityType;
    this.entityId = props.entityId;
    this.payload = props.payload ?? {};
    this.changedAt = props.changedAt ?? new Date().toISOString();
    this._attempts = props.attempts ?? 0;
    this._status =
      props.status instanceof SyncState
        ? props.status
        : new SyncState(props.status ?? 'PENDING');
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

  get ownerId(): string | undefined {
    const raw = this.payload?.ownerId ?? this.payload?.userId;
    return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
  }

  startSync(): void {
    this._status = SyncState.syncing();
  }

  markCompleted(): void {
    this._status = SyncState.completed();
    this._lastError = undefined;
  }

  markFailed(errorMessage: string): void {
    this._attempts += 1;
    this._status = SyncState.failed();
    this._lastError = errorMessage;
  }

  resetForRetry(): void {
    this._status = SyncState.pending();
  }
}
