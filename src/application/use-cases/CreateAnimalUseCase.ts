import { Animal } from '../../domain/entities/Animal';
import { SyncAction } from '../../domain/entities/SyncAction';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';

export interface CreateAnimalOutput {
  animal: Animal;
  synced: boolean;
}

export class CreateAnimalUseCase {
  constructor(
    private animalRepository: AnimalRepository,
    private syncQueueRepository: SyncQueueRepository
  ) {}

  async execute(animal: Animal, isOnline: boolean): Promise<CreateAnimalOutput> {
    await this.animalRepository.saveLocal(animal);

    if (isOnline) {
      try {
        const remote = await this.animalRepository.createRemote(animal);
        return { animal: remote, synced: true };
      } catch {
        // Fallback to queue if remote call fails
        await this.enqueueCreate(animal);
        return { animal, synced: false };
      }
    } else {
      await this.enqueueCreate(animal);
      return { animal, synced: false };
    }
  }

  private async enqueueCreate(animal: Animal): Promise<void> {
    const action = new SyncAction({
      id: `sync_create_${animal.id}`,
      operation: 'CREATE',
      entityType: 'animal',
      entityId: animal.id,
      payload: {
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
        version: animal.version,
      },
    });
    await this.syncQueueRepository.enqueue(action);
  }
}
