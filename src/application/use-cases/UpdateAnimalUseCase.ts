import { Animal } from '../../domain/entities/Animal';
import { SyncAction } from '../../domain/entities/SyncAction';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { AnimalCharacteristics } from '../../domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../domain/value-objects/ApproximateLocation';
import { UnitOfWork } from '../ports/UnitOfWork';
import { NoopUnitOfWork } from '../fakes/NoopUnitOfWork';

export class UpdateAnimalUseCase {
  constructor(
    private animalRepository: AnimalRepository,
    private syncQueueRepository: SyncQueueRepository,
    private unitOfWork: UnitOfWork = new NoopUnitOfWork()
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
    const action = this.buildUpdateAction(animal);

    await this.unitOfWork.run(async () => {
      await this.animalRepository.saveLocal(animal);
      await this.syncQueueRepository.enqueue(action);
    });

    if (isOnline) {
      try {
        await this.animalRepository.updateRemote(animal);
        await this.syncQueueRepository.delete(action.id);
      } catch {
        // Mantém a ação na fila para retry.
      }
    }

    return animal;
  }

  private buildUpdateAction(animal: Animal): SyncAction {
    return new SyncAction({
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
  }
}
