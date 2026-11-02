import { Animal } from '../../domain/entities/Animal';
import { AnimalPhoto } from '../../domain/entities/AnimalPhoto';
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
      /** Foto nova (já persistida localmente): substitui a atual. */
      photo?: AnimalPhoto;
    },
    isOnline: boolean
  ): Promise<Animal> {
    const animal = await this.animalRepository.findById(animalId);
    if (!animal) {
      throw new Error('Anúncio de animal não encontrado.');
    }

    // Uma edição = um bump de versão: a troca de foto não conta à parte.
    if (updates.photo) {
      animal.replacePhotos(requestorId, updates.photo, false);
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
