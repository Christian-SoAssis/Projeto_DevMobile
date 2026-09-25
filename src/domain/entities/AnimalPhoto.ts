import { SyncState } from '../value-objects/SyncState';

export interface AnimalPhotoProps {
  id: string;
  animalId: string;
  localPath?: string;
  remoteUrl?: string;
  syncState?: SyncState;
  createdAt?: string;
}

export class AnimalPhoto {
  readonly id: string;
  readonly animalId: string;
  private _localPath?: string;
  private _remoteUrl?: string;
  private _syncState: SyncState;
  readonly createdAt: string;

  constructor(props: AnimalPhotoProps) {
    if (!props.id) throw new Error('ID da foto é obrigatório.');
    if (!props.animalId) throw new Error('ID do animal é obrigatório.');
    if (!props.localPath && !props.remoteUrl) {
      throw new Error('A foto deve possuir um caminho local ou uma URL remota.');
    }

    this.id = props.id;
    this.animalId = props.animalId;
    this._localPath = props.localPath;
    this._remoteUrl = props.remoteUrl;
    this._syncState = props.syncState || (props.remoteUrl ? SyncState.completed() : SyncState.pending());
    this.createdAt = props.createdAt || new Date().toISOString();
  }

  get localPath(): string | undefined {
    return this._localPath;
  }

  get remoteUrl(): string | undefined {
    return this._remoteUrl;
  }

  get syncState(): SyncState {
    return this._syncState;
  }

  get displayUrl(): string {
    return this._remoteUrl || this._localPath || '';
  }

  markUploaded(remoteUrl: string): void {
    if (!remoteUrl || remoteUrl.trim().length === 0) {
      throw new Error('URL remota inválida para upload.');
    }
    this._remoteUrl = remoteUrl.trim();
    this._syncState = SyncState.completed();
  }
}
