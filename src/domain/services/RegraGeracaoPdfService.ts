import { Animal } from '../entities/Animal';
import { PeriodoAvaliacao } from '../entities/PeriodoAvaliacao';

export class RegraGeracaoPdfService {
  static podeGerarPdfAnimal(animal: Animal): boolean {
    return animal.canGeneratePdf();
  }

  static podeGerarPdfPeriodo(periodo: PeriodoAvaliacao): boolean {
    return periodo.podeGerarPdf();
  }
}
