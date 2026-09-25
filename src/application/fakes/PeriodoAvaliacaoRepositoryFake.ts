import { PeriodoAvaliacao } from '../../domain/entities/PeriodoAvaliacao';
import { PeriodoAvaliacaoRepository } from '../../domain/ports/PeriodoAvaliacaoRepository';

export class PeriodoAvaliacaoRepositoryFake implements PeriodoAvaliacaoRepository {
  public items: Map<string, PeriodoAvaliacao> = new Map();

  async findById(id: string): Promise<PeriodoAvaliacao | null> {
    return this.items.get(id) || null;
  }

  async save(periodo: PeriodoAvaliacao): Promise<void> {
    this.items.set(periodo.id, periodo);
  }

  async listByEstagio(estagioId: string): Promise<PeriodoAvaliacao[]> {
    return Array.from(this.items.values()).filter((p) => p.estagioId === estagioId);
  }
}
