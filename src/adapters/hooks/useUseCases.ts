import { useMemo } from 'react';
import { useRepositories } from '../context/RepositoriesContext';
import { SearchAnimalsUseCase } from '../../application/use-cases/SearchAnimalsUseCase';
import { GetAnimalDetailsUseCase } from '../../application/use-cases/GetAnimalDetailsUseCase';
import { CreateAnimalUseCase } from '../../application/use-cases/CreateAnimalUseCase';
import { UpdateAnimalUseCase } from '../../application/use-cases/UpdateAnimalUseCase';
import { DeleteAnimalUseCase } from '../../application/use-cases/DeleteAnimalUseCase';
import { MarkAnimalAdoptedUseCase } from '../../application/use-cases/MarkAnimalAdoptedUseCase';
import { ToggleFavoriteUseCase } from '../../application/use-cases/ToggleFavoriteUseCase';
import { RegisterAdoptionInterestUseCase } from '../../application/use-cases/RegisterAdoptionInterestUseCase';
import { UpdateInterestStatusUseCase } from '../../application/use-cases/UpdateInterestStatusUseCase';
import { ResolveSyncConflictUseCase } from '../../application/use-cases/ResolveSyncConflictUseCase';
import { ModerateAnimalUseCase } from '../../application/use-cases/ModerateAnimalUseCase';

/**
 * Hook de ponte centralizado que instancia e memoriza os casos de uso
 * conectados ao `AppContainer` atual, eliminando duplicação de `useMemo` nas telas.
 */
export function useUseCases() {
  const container = useRepositories();

  return useMemo(
    () => ({
      searchAnimalsUseCase: new SearchAnimalsUseCase(
        container.animalRepository,
        container.syncQueueRepository
      ),
      getAnimalDetailsUseCase: new GetAnimalDetailsUseCase(
        container.animalRepository,
        container.remoteAnimalSource
      ),
      createAnimalUseCase: new CreateAnimalUseCase(
        container.animalRepository,
        container.syncQueueRepository,
        container.photoStorage,
        container.unitOfWork,
        container.remoteAnimalSource,
        container.remotePhotoStorage
      ),
      updateAnimalUseCase: new UpdateAnimalUseCase(
        container.animalRepository,
        container.syncQueueRepository,
        container.photoStorage,
        container.unitOfWork,
        container.remoteAnimalSource,
        container.remotePhotoStorage
      ),
      deleteAnimalUseCase: new DeleteAnimalUseCase(
        container.animalRepository,
        container.syncQueueRepository,
        container.remoteAnimalSource
      ),
      markAnimalAdoptedUseCase: new MarkAnimalAdoptedUseCase(
        container.animalRepository,
        container.syncQueueRepository,
        container.remoteAnimalSource
      ),
      toggleFavoriteUseCase: new ToggleFavoriteUseCase(
        container.favoriteRepository,
        container.syncQueueRepository,
        container.remoteFavorites
      ),
      registerAdoptionInterestUseCase: new RegisterAdoptionInterestUseCase(
        container.interestRepository,
        container.animalRepository,
        container.syncQueueRepository,
        container.remoteInterests
      ),
      updateInterestStatusUseCase: new UpdateInterestStatusUseCase(
        container.interestRepository,
        container.animalRepository,
        container.syncQueueRepository,
        container.remoteInterests,
        container.remoteAnimalSource
      ),
      resolveSyncConflictUseCase: new ResolveSyncConflictUseCase(
        container.animalRepository,
        container.syncQueueRepository,
        container.remoteAnimalSource
      ),
      moderateAnimalUseCase: new ModerateAnimalUseCase(
        container.animalRepository,
        container.moderationGateway
      ),
    }),
    [container]
  );
}
