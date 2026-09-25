import { Animal } from '../../domain/entities/Animal';
import { PeriodoAvaliacao } from '../../domain/entities/PeriodoAvaliacao';
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

  executeForPeriodo(periodo: PeriodoAvaliacao): { pdfBase64: string } {
    if (!RegraGeracaoPdfService.podeGerarPdfPeriodo(periodo)) {
      throw new Error('Não é possível gerar PDF: período sem atividades ou sem assinaturas válidas.');
    }
    return {
      pdfBase64: `data:application/pdf;base64,mock_pdf_periodo_${periodo.id}`,
    };
  }
}
