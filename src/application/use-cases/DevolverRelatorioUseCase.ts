import { PeriodoAvaliacao } from '../../domain/entities/PeriodoAvaliacao';
import { PeriodoAvaliacaoRepository } from '../../domain/ports/PeriodoAvaliacaoRepository';
import { RegraDevolucaoService } from '../../domain/services/RegraDevolucaoService';

export class DevolverRelatorioUseCase {
  constructor(private repo: PeriodoAvaliacaoRepository) {}

  async execute(periodoId: string, motivo: string): Promise<PeriodoAvaliacao> {
    const p = await this.repo.findById(periodoId);
    if (!p) throw new Error('Período de avaliação não encontrado.');
    RegraDevolucaoService.devolverPeriodo(p, motivo);
    await this.repo.save(p);
    return p;
  }
}
