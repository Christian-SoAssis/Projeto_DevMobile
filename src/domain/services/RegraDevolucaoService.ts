import { PeriodoAvaliacao } from '../entities/PeriodoAvaliacao';

export class RegraDevolucaoService {
  static devolverPeriodo(periodo: PeriodoAvaliacao, motivo: string): void {
    if (!motivo || motivo.trim().length === 0) {
      throw new Error('Motivo da devolução é obrigatório.');
    }
    periodo.devolver();
  }
}
