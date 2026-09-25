import { PeriodoAvaliacao } from '../../domain/entities/PeriodoAvaliacao';
import { PeriodoAvaliacaoRepository } from '../../domain/ports/PeriodoAvaliacaoRepository';
import { Criterio } from '../../domain/value-objects/Criterio';

export class RealizarAutoAvaliacaoUseCase {
  constructor(private repo: PeriodoAvaliacaoRepository) {}

  async execute(periodoId: string, criterios: Criterio[]): Promise<PeriodoAvaliacao> {
    const p = await this.repo.findById(periodoId);
    if (!p) throw new Error('Período de avaliação não encontrado.');
    p.registrarAutoAvaliacao(criterios);
    await this.repo.save(p);
    return p;
  }
}
