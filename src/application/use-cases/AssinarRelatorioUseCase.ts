import { PeriodoAvaliacao } from '../../domain/entities/PeriodoAvaliacao';
import { PeriodoAvaliacaoRepository } from '../../domain/ports/PeriodoAvaliacaoRepository';
import { Assinatura } from '../../domain/value-objects/Assinatura';

export class AssinarRelatorioUseCase {
  constructor(private repo: PeriodoAvaliacaoRepository) {}

  async execute(periodoId: string, assinatura: Assinatura): Promise<PeriodoAvaliacao> {
    const p = await this.repo.findById(periodoId);
    if (!p) throw new Error('Período de avaliação não encontrado.');
    p.adicionarAssinatura(assinatura);
    await this.repo.save(p);
    return p;
  }
}
