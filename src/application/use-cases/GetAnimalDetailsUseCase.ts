import { Animal } from '../../domain/entities/Animal';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { RemoteAnimalSource } from '../../domain/ports/RemoteAnimalSource';

export class GetAnimalDetailsUseCase {
  constructor(
    private animalRepository: AnimalRepository,
    private remoteAnimalSource?: RemoteAnimalSource
  ) {}

  async execute(id: string, isOnline: boolean = true): Promise<Animal | null> {
    const local = await this.animalRepository.findById(id);
    if (local) return local;

    if (isOnline && this.remoteAnimalSource) {
      try {
        const remote = await this.remoteAnimalSource.findById(id);
        if (remote) {
          await this.animalRepository.upsertCache([remote]);
          return remote;
        }
      } catch {
        // Fallback silencioso para null
      }
    }
    return null;
  }
}
