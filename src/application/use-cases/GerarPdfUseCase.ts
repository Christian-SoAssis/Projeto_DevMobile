import { Animal } from '../../domain/entities/Animal';
import { RegraGeracaoPdfService } from '../../domain/services/RegraGeracaoPdfService';

export class GerarPdfUseCase {
  executeForAnimal(animal: Animal): { pdfBase64: string } {
    if (!RegraGeracaoPdfService.podeGerarPdfAnimal(animal)) {
      throw new Error('Não é possível gerar PDF para este animal: informações incompletas.');
    }
    return {
      pdfBase64: `data:application/pdf;base64,mock_pdf_animal_${animal.id}`,
    };
  }
}
