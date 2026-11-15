import { Animal } from '../../domain/entities/Animal';
import { AnimalPhoto } from '../../domain/entities/AnimalPhoto';
import { SyncAction } from '../../domain/entities/SyncAction';
import { AnimalCharacteristics } from '../../domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../domain/value-objects/ApproximateLocation';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { PhotoStorage } from '../../domain/ports/PhotoStorage';
import { RemoteAnimalSource } from '../../domain/ports/RemoteAnimalSource';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { UnitOfWork } from '../ports/UnitOfWork';

export interface UpdateAnimalInput {
  animalId: string;
  actorUserId: string;
  name?: string;
  characteristics?: AnimalCharacteristics;
  location?: ApproximateLocation;
  photos?: AnimalPhoto[];
  isOnline: boolean;
}

export class UpdateAnimalUseCase {
  constructor(
    private animalRepository: AnimalRepository,
    private syncQueueRepository: SyncQueueRepository,
    private photoStorage?: PhotoStorage,
    private unitOfWork?: UnitOfWork,
    private remoteAnimalSource?: RemoteAnimalSource,
    private remotePhotoStorage?: PhotoStorage
  ) {}

  async execute(input: UpdateAnimalInput): Promise<{ animal: Animal; synced: boolean }> {
    const existing = await this.animalRepository.findById(input.animalId);
    if (!existing) {
      throw new Error('Anúncio não encontrado.');
    }

    const previousVersion = existing.version;
    let updatedPhotos = input.photos;
    if (updatedPhotos && this.photoStorage) {
      const persisted: AnimalPhoto[] = [];
      for (const p of updatedPhotos) {
        if (p.localPath && !p.remoteUrl) {
          persisted.push(await this.photoStorage.persistLocal(p));
        } else {
          persisted.push(p);
        }
      }
      updatedPhotos = persisted;
    }

    existing.updateData(input.actorUserId, {
      name: input.name,
      characteristics: input.characteristics,
      location: input.location,
      photos: updatedPhotos,
    });

    const action = new SyncAction({
      id: `sync_update_${existing.id}_v${existing.version}`,
      operation: 'UPDATE',
      entityType: 'animal',
      entityId: existing.id,
      payload: {
        id: existing.id,
        ownerId: existing.ownerId,
        name: existing.name,
        species: existing.characteristics.species,
        size: existing.characteristics.size,
        approximateAge: existing.characteristics.approximateAge,
        sex: existing.characteristics.sex,
        characteristics: existing.characteristics.characteristics,
        behavior: existing.characteristics.behavior,
        specialCare: existing.characteristics.specialCare,
        city: existing.location.city,
        neighborhood: existing.location.neighborhood,
        region: existing.location.region,
        latitude: existing.location.latitude,
        longitude: existing.location.longitude,
        status: existing.status.value,
        expectedVersion: previousVersion,
        version: existing.version,
      },
    });

    const saveLocal = async () => {
      await this.animalRepository.saveLocal(existing);
      await this.syncQueueRepository.enqueue(action);
    };

    if (this.unitOfWork) {
      await this.unitOfWork.runInTransaction(saveLocal);
    } else {
      await saveLocal();
    }

    if (input.isOnline && this.remoteAnimalSource) {
      try {
        if (this.remotePhotoStorage) {
          const uploaded: AnimalPhoto[] = [];
          for (const p of existing.photos) {
            if (!p.remoteUrl && p.localPath) {
              uploaded.push(await this.remotePhotoStorage.uploadPending(p));
            } else {
              uploaded.push(p);
            }
          }
          existing.setPhotos(uploaded);
        }
        const remote = await this.remoteAnimalSource.updateRemote(existing, previousVersion);
        await this.animalRepository.saveLocal(remote);
        await this.syncQueueRepository.delete(action.id);
        return { animal: remote, synced: true };
      } catch (err) {
        action.markFailed(err instanceof Error ? err.message : 'Falha ao atualizar anúncio no servidor.');
        await this.syncQueueRepository.update(action);
        return { animal: existing, synced: false };
      }
    }

    return { animal: existing, synced: false };
  }
}
