import { Animal } from '../../domain/entities/Animal';
import { AnimalPhoto } from '../../domain/entities/AnimalPhoto';
import { SyncAction } from '../../domain/entities/SyncAction';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { PhotoStorage } from '../../domain/ports/PhotoStorage';
import { RemoteAnimalSource } from '../../domain/ports/RemoteAnimalSource';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { UnitOfWork } from '../ports/UnitOfWork';

export interface CreateAnimalResult {
  animal: Animal;
  synced: boolean;
}

/**
 * Criação de anúncio offline-first (UC07, RF08, RF09, RF18, RF19, RF26, OFF-04).
 * 1. Persiste fotos localmente (convertidas em WebP e copiadas para área segura).
 * 2. Grava anúncio no SQLite.
 * 3. Se online e com Supabase, envia fotos ao Storage e cria o registro remoto imediatamente.
 * 4. Se offline ou em caso de falha de rede, enfileira `CREATE` na `sync_queue`.
 */
export class CreateAnimalUseCase {
  constructor(
    private animalRepository: AnimalRepository,
    private syncQueueRepository: SyncQueueRepository,
    private photoStorage?: PhotoStorage,
    private unitOfWork?: UnitOfWork,
    private remoteAnimalSource?: RemoteAnimalSource,
    private remotePhotoStorage?: PhotoStorage
  ) {}

  async execute(animal: Animal, isOnline: boolean): Promise<CreateAnimalResult> {
    const persistedPhotos: AnimalPhoto[] = [];
    for (const photo of animal.photos) {
      if (this.photoStorage && photo.localPath) {
        const persisted = await this.photoStorage.persistLocal(photo);
        persistedPhotos.push(persisted);
      } else {
        persistedPhotos.push(photo);
      }
    }
    animal.setPhotos(persistedPhotos);

    const action = new SyncAction({
      id: `sync_create_${animal.id}`,
      operation: 'CREATE',
      entityType: 'animal',
      entityId: animal.id,
      payload: this.buildPayload(animal),
    });

    const saveLocalWithOutbox = async () => {
      await this.animalRepository.saveLocal(animal);
      await this.syncQueueRepository.enqueue(action);
    };

    if (this.unitOfWork) {
      await this.unitOfWork.runInTransaction(saveLocalWithOutbox);
    } else {
      await saveLocalWithOutbox();
    }

    if (isOnline && this.remoteAnimalSource) {
      try {
        const uploadedPhotos: AnimalPhoto[] = [];
        for (const photo of animal.photos) {
          if (this.remotePhotoStorage && !photo.remoteUrl && photo.localPath) {
            const uploaded = await this.remotePhotoStorage.uploadPending(photo);
            uploadedPhotos.push(uploaded);
          } else if (this.photoStorage && !photo.remoteUrl && photo.localPath) {
            const uploaded = await this.photoStorage.uploadPending(photo);
            uploadedPhotos.push(uploaded);
          } else {
            uploadedPhotos.push(photo);
          }
        }
        animal.setPhotos(uploadedPhotos);

        const remoteAnimal = await this.remoteAnimalSource.createRemote(animal);
        await this.animalRepository.saveLocal(remoteAnimal);
        await this.syncQueueRepository.delete(action.id);
        return { animal: remoteAnimal, synced: true };
      } catch (err) {
        action.markFailed(err instanceof Error ? err.message : 'Falha ao enviar anúncio ao servidor.');
        await this.syncQueueRepository.update(action);
        return { animal, synced: false };
      }
    }

    return { animal, synced: false };
  }

  private buildPayload(animal: Animal): Record<string, unknown> {
    return {
      id: animal.id,
      ownerId: animal.ownerId,
      name: animal.name,
      species: animal.characteristics.species,
      size: animal.characteristics.size,
      approximateAge: animal.characteristics.approximateAge,
      sex: animal.characteristics.sex,
      characteristics: animal.characteristics.characteristics,
      behavior: animal.characteristics.behavior,
      specialCare: animal.characteristics.specialCare,
      city: animal.location.city,
      neighborhood: animal.location.neighborhood,
      region: animal.location.region,
      latitude: animal.location.latitude,
      longitude: animal.location.longitude,
      status: animal.status.value,
      version: animal.version,
    };
  }
}
