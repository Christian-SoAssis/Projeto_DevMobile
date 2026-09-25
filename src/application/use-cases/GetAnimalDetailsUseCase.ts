import { Animal } from '../../domain/entities/Animal';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';

export class GetAnimalDetailsUseCase {
  constructor(private animalRepository: AnimalRepository) {}

  async execute(id: string): Promise<Animal | null> {
    if (!id) throw new Error('ID do animal é obrigatório.');
    return this.animalRepository.findById(id);
  }
}
