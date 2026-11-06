export interface SyncMetadataProps {
  key: string;
  lastSyncAt?: string;
  lastSuccessAt?: string;
  version?: number;
  /**
   * Cursor opaco do pull incremental (OFF-06, ordem 6) — serializado pelo
   * caso de uso que o usa; o repositório só o persiste.
   */
  cursor?: string;
}

export class SyncMetadata {
  readonly key: string;
  private _lastSyncAt?: string;
  private _lastSuccessAt?: string;
  private _version: number;
  private _cursor?: string;

  constructor(props: SyncMetadataProps) {
    if (!props.key) throw new Error('Chave do estado de sincronização é obrigatória.');

    this.key = props.key;
    this._lastSyncAt = props.lastSyncAt;
    this._lastSuccessAt = props.lastSuccessAt;
    this._version = props.version || 0;
    this._cursor = props.cursor;
  }

  get cursor(): string | undefined {
    return this._cursor;
  }

  setCursor(cursor: string | undefined): void {
    this._cursor = cursor;
  }

  get lastSyncAt(): string | undefined {
    return this._lastSyncAt;
  }

  get lastSuccessAt(): string | undefined {
    return this._lastSuccessAt;
  }

  get version(): number {
    return this._version;
  }

  markSynced(at?: string): void {
    this._lastSyncAt = at || new Date().toISOString();
  }

  markSuccess(at?: string): void {
    this._lastSuccessAt = at || new Date().toISOString();
  }
}
