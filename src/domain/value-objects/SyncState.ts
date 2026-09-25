export type SyncStateType = 'PENDING' | 'SYNCING' | 'FAILED' | 'COMPLETED';

export class SyncState {
  readonly value: SyncStateType;

  constructor(value: SyncStateType | 'pending' | 'synced' | 'error') {
    let normalized: SyncStateType;
    if (value === 'pending' || value === 'PENDING') normalized = 'PENDING';
    else if (value === 'synced' || value === 'COMPLETED') normalized = 'COMPLETED';
    else if (value === 'error' || value === 'FAILED') normalized = 'FAILED';
    else if (value === 'SYNCING') normalized = 'SYNCING';
    else {
      throw new Error(`Status de sincronização inválido: ${value}`);
    }
    this.value = normalized;
  }

  isPending(): boolean {
    return this.value === 'PENDING';
  }

  isSyncing(): boolean {
    return this.value === 'SYNCING';
  }

  isFailed(): boolean {
    return this.value === 'FAILED';
  }

  isCompleted(): boolean {
    return this.value === 'COMPLETED';
  }

  static pending(): SyncState {
    return new SyncState('PENDING');
  }

  static syncing(): SyncState {
    return new SyncState('SYNCING');
  }

  static failed(): SyncState {
    return new SyncState('FAILED');
  }

  static completed(): SyncState {
    return new SyncState('COMPLETED');
  }
}
