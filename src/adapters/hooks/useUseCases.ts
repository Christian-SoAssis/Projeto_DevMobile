import { useMemo } from 'react';
import { Animal } from '../../domain/entities/Animal';
import { AnimalPhoto } from '../../domain/entities/AnimalPhoto';
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
import { PullRemoteInterestsUseCase } from '../../application/use-cases/PullRemoteInterestsUseCase';
import { getActiveUserId } from '../sync/activeSession';
import { logger } from '../logging/logger';

/**
 * Hook de ponte centralizado que instancia e memoriza os casos de uso e consultas
 * conectados ao `AppContainer` atual, evitando que as telas acessem repositórios diretamente.
 */
export function useUseCases() {
  const container = useRepositories();

  return useMemo(() => {
    const pullRemoteInterestsUseCase = container.remoteInterests
      ? new PullRemoteInterestsUseCase(
          container.remoteInterests,
          container.interestRepository,
          container.animalRepository,
          container.syncQueueRepository,
          container.appStateRepository,
          { currentUserId: getActiveUserId }
        )
      : undefined;

    return {
      searchAnimalsUseCase: new SearchAnimalsUseCase(
        container.animalRepository,
        container.syncQueueRepository
      ),
      getAnimalDetailsUseCase: new GetAnimalDetailsUseCase(
        container.animalRepository,
        container.remoteAnimalSource,
        container.favoriteRepository,
        container.interestRepository,
        pullRemoteInterestsUseCase
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
      listFavoriteIds: async (userId: string): Promise<Set<string>> => {
        const favs = await container.favoriteRepository.listByUser(userId);
        return new Set(favs.map((f) => f.animalId));
      },
      listFavoriteAnimals: async (userId: string): Promise<Animal[]> => {
        const favs = await container.favoriteRepository.listByUser(userId);
        const loaded: Animal[] = [];
        for (const fav of favs) {
          const anim = await container.animalRepository.findById(fav.animalId);
          if (anim) loaded.push(anim);
        }
        return loaded;
      },
      listOwnedAnimalsWithPendingStatus: async (
        userId: string
      ): Promise<{ animals: Animal[]; pendingAnimalIds: Set<string> }> => {
        const [animals, pending] = await Promise.all([
          container.animalRepository.findByOwner(userId),
          container.syncQueueRepository.listPending(),
        ]);
        const pendingAnimalIds = new Set(
          pending.filter((p) => p.entityType === 'animal').map((p) => p.entityId)
        );
        return { animals, pendingAnimalIds };
      },
      listModerationAnimals: async (): Promise<Animal[]> => {
        if (container.moderationGateway) {
          try {
            const remoteList = await container.moderationGateway.listAllForModeration();
            if (remoteList.length > 0) return remoteList;
          } catch (err) {
            logger.warn('listModerationAnimals.remote', err);
          }
        }
        return container.animalRepository.search({ includeHidden: true });
      },
      pickAndUploadAvatar: async (
        userId: string,
        source: 'CAMERA' | 'GALLERY'
      ): Promise<string | null> => {
        const res =
          source === 'CAMERA'
            ? await container.cameraGateway.capturePhoto()
            : await container.cameraGateway.pickImageFromGallery();
        if (!res?.uri) return null;

        try {
          const photo = new AnimalPhoto({
            animalId: `user:${userId}`,
            localPath: res.uri,
          });
          const persisted = await container.photoStorage.persistLocal(photo);
          if (container.remotePhotoStorage) {
            try {
              const uploaded = await container.remotePhotoStorage.uploadPending(persisted);
              return uploaded.remoteUrl || uploaded.displayUri;
            } catch (err) {
              logger.warn('pickAndUploadAvatar.uploadPending', err);
            }
          }
          return persisted.displayUri;
        } catch (err) {
          logger.warn('pickAndUploadAvatar.persistLocal', err);
          return res.uri;
        }
      },
    };
  }, [container]);
}
