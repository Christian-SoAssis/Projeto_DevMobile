import { useState, useCallback } from 'react';
import { PeriodoAvaliacao, AtividadeDesenvolvida } from '../../domain/entities/PeriodoAvaliacao';
import { PeriodoAvaliacaoRepository } from '../../domain/ports/PeriodoAvaliacaoRepository';
import { RegistrarAtividadesUseCase } from '../../application/use-cases/RegistrarAtividadesUseCase';
import { AssinarRelatorioUseCase } from '../../application/use-cases/AssinarRelatorioUseCase';
import { PeriodoAvaliacaoRepositoryFake } from '../../application/fakes/PeriodoAvaliacaoRepositoryFake';
import { Assinatura } from '../../domain/value-objects/Assinatura';

export function useAtividades(
  repo: PeriodoAvaliacaoRepository = new PeriodoAvaliacaoRepositoryFake()
) {
  const [periodo, setPeriodo] = useState<PeriodoAvaliacao | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const carregarPeriodo = useCallback(
    async (id: string) => {
      setLoading(true);
      try {
        const p = await repo.findById(id);
        setPeriodo(p);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar período.');
      } finally {
        setLoading(false);
      }
    },
    [repo]
  );

  const registrarAtividades = async (periodoId: string, atividades: AtividadeDesenvolvida[]) => {
    setLoading(true);
    try {
      const useCase = new RegistrarAtividadesUseCase(repo);
      const res = await useCase.execute(periodoId, atividades);
      setPeriodo(res);
      return res;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const assinarRelatorio = async (periodoId: string, assinatura: Assinatura) => {
    setLoading(true);
    try {
      const useCase = new AssinarRelatorioUseCase(repo);
      const res = await useCase.execute(periodoId, assinatura);
      setPeriodo(res);
      return res;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    periodo,
    loading,
    error,
    carregarPeriodo,
    registrarAtividades,
    assinarRelatorio,
  };
}
