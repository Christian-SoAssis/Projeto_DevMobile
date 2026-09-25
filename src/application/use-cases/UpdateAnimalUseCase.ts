import { Animal } from '../../domain/entities/Animal';
import { SyncAction } from '../../domain/entities/SyncAction';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { AnimalCharacteristics } from '../../domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../domain/value-objects/ApproximateLocation';

export class UpdateAnimalUseCase {
  constructor(
    private animalRepository: AnimalRepository,
    private syncQueueRepository: SyncQueueRepository
  ) {}

  async execute(
    requestorId: string,
    animalId: string,
    updates: {
      name?: string;
      characteristics?: AnimalCharacteristics;
      location?: ApproximateLocation;
    },
    isOnline: boolean
  ): Promise<Animal> {
    const animal = await this.animalRepository.findById(animalId);
    if (!animal) {
      throw new Error('Anúncio de animal não encontrado.');
    }

    animal.updateData(requestorId, updates);
    await this.animalRepository.saveLocal(animal);

    if (isOnline) {
      try {
        await this.animalRepository.updateRemote(animal);
      } catch {
        await this.enqueueUpdate(animal);
      }
    } else {
      await this.enqueueUpdate(animal);
    }

    return animal;
  }

  private async enqueueUpdate(animal: Animal): Promise<void> {
    const action = new SyncAction({
      id: `sync_update_${animal.id}_v${animal.version}`,
      operation: 'UPDATE',
      entityType: 'animal',
      entityId: animal.id,
      payload: {
        name: animal.name,
        version: animal.version,
        updatedAt: animal.updatedAt,
      },
    });
    await this.syncQueueRepository.enqueue(action);
  }
}
