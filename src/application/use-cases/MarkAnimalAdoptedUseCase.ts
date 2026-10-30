import { Animal } from '../../domain/entities/Animal';
import { SyncAction } from '../../domain/entities/SyncAction';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { UnitOfWork } from '../ports/UnitOfWork';
import { NoopUnitOfWork } from '../fakes/NoopUnitOfWork';

export class MarkAnimalAdoptedUseCase {
  constructor(
    private animalRepository: AnimalRepository,
    private syncQueueRepository: SyncQueueRepository,
    private unitOfWork: UnitOfWork = new NoopUnitOfWork()
  ) {}

  async execute(requestorId: string, animalId: string, isOnline: boolean): Promise<Animal> {
    const animal = await this.animalRepository.findById(animalId);
    if (!animal) {
      throw new Error('Animal não encontrado.');
    }

    animal.markAdopted(requestorId);
    const action = this.buildMarkAdoptedAction(animal);

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

  private buildMarkAdoptedAction(animal: Animal): SyncAction {
    return new SyncAction({
      id: `sync_mark_adopted_${animal.id}`,
      operation: 'MARK_ADOPTED',
      entityType: 'animal',
      entityId: animal.id,
      payload: { animalId: animal.id, status: animal.status.value, version: animal.version },
    });
  }
}
