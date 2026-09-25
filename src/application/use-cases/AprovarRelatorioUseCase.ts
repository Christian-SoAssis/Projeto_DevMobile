import { PeriodoAvaliacao } from '../../domain/entities/PeriodoAvaliacao';
import { PeriodoAvaliacaoRepository } from '../../domain/ports/PeriodoAvaliacaoRepository';

export class AprovarRelatorioUseCase {
  constructor(private repo: PeriodoAvaliacaoRepository) {}

  async execute(periodoId: string): Promise<PeriodoAvaliacao> {
    const p = await this.repo.findById(periodoId);
    if (!p) throw new Error('Período de avaliação não encontrado.');
    p.aprovar();
    await this.repo.save(p);
    return p;
  }
}
