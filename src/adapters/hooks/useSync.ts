import { useState, useCallback } from 'react';
import { SyncAction } from '../../domain/entities/SyncAction';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { PhotoStorage } from '../../domain/ports/PhotoStorage';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { ProcessSyncQueueUseCase } from '../../application/use-cases/ProcessSyncQueueUseCase';
import { getActiveUserId, isVisibleToActiveSession } from '../sync/activeSession';
import { SyncQueueRepositoryFake } from '../../application/fakes/SyncQueueRepositoryFake';
import { AnimalRepositoryFake } from '../../application/fakes/AnimalRepositoryFake';

export function useSync(
  syncQueueRepository: SyncQueueRepository = new SyncQueueRepositoryFake(),
  animalRepository: AnimalRepository = new AnimalRepositoryFake(),
  remotePhotoStorage?: PhotoStorage
) {
  const [pendingItems, setPendingItems] = useState<SyncAction[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const loadPending = useCallback(async () => {
    const pending = await syncQueueRepository.listPending();
    // DAT-10: pendências de outra conta ficam na fila, mas não aparecem.
    setPendingItems(pending.filter(isVisibleToActiveSession));
  }, [syncQueueRepository]);

  const triggerSync = async () => {
    setIsSyncing(true);
    try {
      const useCase = new ProcessSyncQueueUseCase(
        syncQueueRepository,
        animalRepository,
        undefined,
        remotePhotoStorage,
        { currentUserId: getActiveUserId }
      );
      const res = await useCase.execute();
      await loadPending();
      return res;
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    pendingItems,
    isSyncing,
    loadPending,
    triggerSync,
  };
}
