import { PeriodoAvaliacao } from '../entities/PeriodoAvaliacao';

export interface PeriodoAvaliacaoRepository {
  findById(id: string): Promise<PeriodoAvaliacao | null>;
  save(periodo: PeriodoAvaliacao): Promise<void>;
  listByEstagio(estagioId: string): Promise<PeriodoAvaliacao[]>;
}
