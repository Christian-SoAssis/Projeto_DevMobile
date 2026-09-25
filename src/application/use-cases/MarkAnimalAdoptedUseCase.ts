import { Animal } from '../../domain/entities/Animal';
import { SyncAction } from '../../domain/entities/SyncAction';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';

export class MarkAnimalAdoptedUseCase {
  constructor(
    private animalRepository: AnimalRepository,
    private syncQueueRepository: SyncQueueRepository
  ) {}

  async execute(requestorId: string, animalId: string, isOnline: boolean): Promise<Animal> {
    const animal = await this.animalRepository.findById(animalId);
    if (!animal) {
      throw new Error('Animal não encontrado.');
    }

    animal.markAdopted(requestorId);
    await this.animalRepository.saveLocal(animal);

    if (isOnline) {
      try {
        await this.animalRepository.updateRemote(animal);
      } catch {
        await this.enqueueMarkAdopted(animal);
      }
    } else {
      await this.enqueueMarkAdopted(animal);
    }

    return animal;
  }

  private async enqueueMarkAdopted(animal: Animal): Promise<void> {
    const action = new SyncAction({
      id: `sync_mark_adopted_${animal.id}`,
      operation: 'MARK_ADOPTED',
      entityType: 'animal',
      entityId: animal.id,
      payload: { animalId: animal.id, status: animal.status.value, version: animal.version },
    });
    await this.syncQueueRepository.enqueue(action);
  }
}
