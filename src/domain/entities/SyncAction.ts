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

/** Prefixo gravado em `lastError` quando a ação exige revisão manual do responsável (RF23). */
export const SYNC_CONFLICT_MARKER = '[CONFLITO]';

/**
 * Prefixo gravado em `lastError` quando a falha é PERMANENTE (OFF-05,
 * DAT-11): tentar de novo nunca mudará o resultado (ex.: operação não
 * suportada, anúncio apagado enquanto a fila esperava). Persiste na
 * própria `last_error` — sem coluna nova e sobrevive a reinícios, mesmo
 * padrão do marcador de conflito.
 */
export const PERMANENT_SYNC_FAILURE_MARKER = '[ERRO PERMANENTE]';

export class SyncAction {
  readonly id: string;
  readonly operation: SyncOperation;
  readonly entityType: SyncEntityType;
  readonly entityId: string;
  readonly payload: Record<string, unknown>;
  private _changedAt: string;
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
    this._changedAt = props.changedAt || new Date().toISOString();
    this._attempts = props.attempts || 0;
    this._status = props.status || SyncState.pending();
    this._lastError = props.lastError;
  }

  /**
   * DAT-10 (ordens 0/2): conta dona da ação — `ownerId` (anúncios) ou
   * `userId` (favoritos/interesses) do payload. Sem coluna nova: o dono
   * viaja no `payload_json`. `undefined` = item legado sem dono gravado
   * (o worker resolve pelo anúncio local quando possível).
   */
  get ownerId(): string | undefined {
    const raw = this.payload.ownerId ?? this.payload.userId;
    return typeof raw === 'string' && raw ? raw : undefined;
  }

  get attempts(): number {
    return this._attempts;
  }

  /**
   * Momento da última alteração (criação, envio, falha). O `markFailed`
   * regrava — o ESPEÇAMENTO de retry (OFF-05) conta a partir da ÚLTIMA
   * falha, não da criação da ação.
   */
  get changedAt(): string {
    return this._changedAt;
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

  markFailed(error: string, at?: string): void {
    this._attempts += 1;
    this._lastError = error;
    this._status = SyncState.failed();
    this._changedAt = at ?? new Date().toISOString();
  }

  /**
   * OFF-05/DAT-11: falha PERMANENTE (retry não resolve) marcada com
   * prefixo para sobreviver a reinícios (sem coluna nova: fica na
   * `last_error`, como o marcador de conflito RF23).
   */
  markFailedPermanently(error: string, at?: string): void {
    this.markFailed(`${PERMANENT_SYNC_FAILURE_MARKER} ${error}`, at);
  }

  /** Conflito com risco de perda: nunca é reenviado sozinho, só após revisão (doc §9.4). */
  get isConflict(): boolean {
    return this._status.isFailed() && (this._lastError ?? '').startsWith(SYNC_CONFLICT_MARKER);
  }

  markConflict(reason: string): void {
    this.markFailed(`${SYNC_CONFLICT_MARKER} ${reason}`);
  }

  /** Revisão concluída: a ação volta à fila como nova. */
  clearConflict(): void {
    this._attempts = 0;
    this._lastError = undefined;
    this._status = SyncState.pending();
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
