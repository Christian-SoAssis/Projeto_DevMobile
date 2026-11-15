import { useCallback } from 'react';
import { AppContainer } from '../../infrastructure/composition/loadAppContainer';
import { useRepositories } from '../context/RepositoriesContext';
import { ProcessSyncQueueUseCase } from '../../application/use-cases/ProcessSyncQueueUseCase';
import { PullRemoteAnimalsUseCase } from '../../application/use-cases/PullRemoteAnimalsUseCase';
import { RunFullSyncUseCase, FullSyncResult } from '../../application/use-cases/RunFullSyncUseCase';
import { notifyPullCompleted } from '../sync/pullEvents';
import { notifyNotificationsChanged } from '../sync/notificationEvents';
import { getActiveUserId } from '../sync/activeSession';

const cycles = new WeakMap<AppContainer, RunFullSyncUseCase>();

class PullNotifyingFullSync extends RunFullSyncUseCase {
  async execute(): Promise<FullSyncResult> {
    const result = await super.execute();
    notifyPullCompleted();
    notifyNotificationsChanged();
    return result;
  }
}

export function getFullSync(container: AppContainer): RunFullSyncUseCase {
  const existing = cycles.get(container);
  if (existing) return existing;

  const push = new ProcessSyncQueueUseCase(
    container.syncQueueRepository,
    container.animalRepository,
    undefined,
    container.remotePhotoStorage,
    {
      remoteAnimals: container.remoteAnimalSource,
      favorites: container.remoteFavorites,
      interests: container.remoteInterests,
      currentUserId: getActiveUserId,
    }
  );

  const pull = container.remoteAnimalSource
    ? new PullRemoteAnimalsUseCase(
        container.remoteAnimalSource,
        container.animalRepository,
        container.syncQueueRepository,
        container.syncMetadataRepository,
        100,
        { currentUserId: getActiveUserId }
      )
    : undefined;

  const cycle = new PullNotifyingFullSync(push, pull);
  cycles.set(container, cycle);
  return cycle;
}

export function useFullSync(): () => Promise<FullSyncResult> {
  const container = useRepositories();
  return useCallback(() => getFullSync(container).execute(), [container]);
}
