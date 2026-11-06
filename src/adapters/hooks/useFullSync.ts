import { useCallback } from 'react';
import { AppContainer } from '../../infrastructure/composition/loadAppContainer';
import { useRepositories } from '../context/RepositoriesContext';
import { ProcessSyncQueueUseCase } from '../../application/use-cases/ProcessSyncQueueUseCase';
import { PullRemoteAnimalsUseCase } from '../../application/use-cases/PullRemoteAnimalsUseCase';
import { RunFullSyncUseCase, FullSyncResult } from '../../application/use-cases/RunFullSyncUseCase';
import { notifyPullCompleted } from '../sync/pullEvents';

/**
 * Uma única instância do ciclo de sincronização por container: a trava
 * anti-concorrência (doc §14.1 passo 2) precisa valer para o botão manual
 * e para o disparo automático ao reconectar.
 */
const cycles = new WeakMap<AppContainer, RunFullSyncUseCase>();

/**
 * Observação de adapters (OFF-02, checklist T28): quando o pull completa o
 * cache local mudou — as telas abertas devem re-consultar a última lista.
 * O evento vive na camada de adapters; o travamento anti-concorrência
 * (`running`) fica no caso de uso puro e não é duplicado aqui.
 */
class PullNotifyingFullSync extends RunFullSyncUseCase {
  async execute(): Promise<FullSyncResult> {
    const result = await super.execute();
    if (result.pull) notifyPullCompleted();
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
    }
  );
  const pull = container.remoteAnimalSource
    ? new PullRemoteAnimalsUseCase(
        container.remoteAnimalSource,
        container.animalRepository,
        container.syncQueueRepository,
        container.syncMetadataRepository
      )
    : undefined;
  const cycle = new PullNotifyingFullSync(push, pull);
  cycles.set(container, cycle);
  return cycle;
}

/** `sync()` estável: envia a fila e, com backend, atualiza o cache pelo servidor. */
export function useFullSync(): () => Promise<FullSyncResult> {
  const container = useRepositories();
  return useCallback(() => getFullSync(container).execute(), [container]);
}
