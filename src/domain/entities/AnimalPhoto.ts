import { SyncState } from '../value-objects/SyncState';
import { generateUuid } from '../services/IdGenerator';

export interface AnimalPhotoProps {
  id?: string;
  animalId: string;
  localPath?: string;
  remoteUrl?: string;
  syncState?: SyncState;
  createdAt?: string;
}

/**
 * Foto vinculada a um anúncio de animal (RF09, RF26, RNF10).
 * Pode existir apenas localmente (`localPath`) enquanto aguarda upload.
 */
export class AnimalPhoto {
  public readonly id: string;
  public readonly animalId: string;
  public localPath?: string;
  public remoteUrl?: string;
  public syncState: SyncState;
  public readonly createdAt: string;

  constructor(props: AnimalPhotoProps) {
    if (!props.localPath && !props.remoteUrl) {
      throw new Error('A foto precisa de um caminho local ou URL remota.');
    }
    this.id = props.id ?? generateUuid();
    this.animalId = props.animalId;
    this.localPath = props.localPath;
    this.remoteUrl = props.remoteUrl;
    this.syncState =
      props.syncState ?? (props.remoteUrl ? SyncState.completed() : SyncState.pending());
    this.createdAt = props.createdAt ?? new Date().toISOString();
  }

  markUploaded(remoteUrl: string): void {
    if (!remoteUrl || !remoteUrl.trim()) {
      throw new Error('URL remota inválida para a foto.');
    }
    this.remoteUrl = remoteUrl.trim();
    this.syncState = SyncState.completed();
  }

  markFailed(): void {
    this.syncState = SyncState.failed();
  }

  /** Resolução local-primeiro (RNF01/RNF02): usa arquivo local se disponível, senão remota. */
  get displayUri(): string {
    return this.localPath || this.remoteUrl || '';
  }
}
