import { Animal } from '../entities/Animal';

export class RegraGeracaoPdfService {
  static podeGerarPdfAnimal(animal: Animal): boolean {
    return animal.canGeneratePdf();
  }
}
