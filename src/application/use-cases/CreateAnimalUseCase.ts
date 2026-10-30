import { Animal } from '../../domain/entities/Animal';
import { SyncAction } from '../../domain/entities/SyncAction';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { UnitOfWork } from '../ports/UnitOfWork';
import { NoopUnitOfWork } from '../fakes/NoopUnitOfWork';

export interface CreateAnimalOutput {
  animal: Animal;
  synced: boolean;
}

export class CreateAnimalUseCase {
  constructor(
    private animalRepository: AnimalRepository,
    private syncQueueRepository: SyncQueueRepository,
    private unitOfWork: UnitOfWork = new NoopUnitOfWork()
  ) {}

  async execute(animal: Animal, isOnline: boolean): Promise<CreateAnimalOutput> {
    const action = this.buildCreateAction(animal);

    // Outbox local: anúncio + ação entram juntos. Se o processo cair depois
    // do save, a intenção de sincronizar não é perdida.
    await this.unitOfWork.run(async () => {
      await this.animalRepository.saveLocal(animal);
      await this.syncQueueRepository.enqueue(action);
    });

    if (isOnline) {
      try {
        const remote = await this.animalRepository.createRemote(animal);
        await this.syncQueueRepository.delete(action.id);
        return { animal: remote, synced: true };
      } catch {
        // A ação permanece na fila para retry (Fase 6).
        return { animal, synced: false };
      }
    }

    return { animal, synced: false };
  }

  private buildCreateAction(animal: Animal): SyncAction {
    return new SyncAction({
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
  }
}
