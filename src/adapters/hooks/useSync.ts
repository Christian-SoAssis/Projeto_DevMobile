import { useState, useCallback } from 'react';
import { SyncAction } from '../../domain/entities/SyncAction';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { ProcessSyncQueueUseCase } from '../../application/use-cases/ProcessSyncQueueUseCase';
import { SyncQueueRepositoryFake } from '../../application/fakes/SyncQueueRepositoryFake';
import { AnimalRepositoryFake } from '../../application/fakes/AnimalRepositoryFake';

export function useSync(
  syncQueueRepository: SyncQueueRepository = new SyncQueueRepositoryFake(),
  animalRepository: AnimalRepository = new AnimalRepositoryFake()
) {
  const [pendingItems, setPendingItems] = useState<SyncAction[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const loadPending = useCallback(async () => {
    const pending = await syncQueueRepository.listPending();
    setPendingItems(pending);
  }, [syncQueueRepository]);

  const triggerSync = async () => {
    setIsSyncing(true);
    try {
      const useCase = new ProcessSyncQueueUseCase(syncQueueRepository, animalRepository);
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
