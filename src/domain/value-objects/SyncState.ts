export type SyncStateType = 'PENDING' | 'SYNCING' | 'FAILED' | 'COMPLETED';

export class SyncState {
  public readonly value: SyncStateType;

  constructor(value: SyncStateType = 'PENDING') {
    if (
      value !== 'PENDING' &&
      value !== 'SYNCING' &&
      value !== 'FAILED' &&
      value !== 'COMPLETED'
    ) {
      throw new Error(`Estado de sincronização inválido: ${String(value)}`);
    }
    this.value = value;
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
}
