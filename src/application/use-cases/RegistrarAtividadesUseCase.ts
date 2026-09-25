import { PeriodoAvaliacao, AtividadeDesenvolvida } from '../../domain/entities/PeriodoAvaliacao';
import { PeriodoAvaliacaoRepository } from '../../domain/ports/PeriodoAvaliacaoRepository';

export class RegistrarAtividadesUseCase {
  constructor(private repo: PeriodoAvaliacaoRepository) {}

  async execute(periodoId: string, atividades: AtividadeDesenvolvida[]): Promise<PeriodoAvaliacao> {
    const p = await this.repo.findById(periodoId);
    if (!p) throw new Error('Período de avaliação não encontrado.');
    atividades.forEach((atv) => p.adicionarAtividade(atv));
    await this.repo.save(p);
    return p;
  }
}
