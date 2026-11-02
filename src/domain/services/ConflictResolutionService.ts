import { Animal } from '../entities/Animal';

export interface ConflictEvaluationResult {
  needsReview: boolean;
  chosenVersion?: Animal;
  reason?: string;
}

export class ConflictResolutionService {
  /**
   * `UPDATE` recusado por versão defasada: o servidor avançou enquanto a
   * edição local estava pendente, então HÁ conflito mesmo que os números de
   * versão coincidam (as duas pontas partiram da mesma base e cada uma
   * somou 1). Regras do doc §9.4: mesma situação do animal → vence a edição
   * mais recente; situação divergente → revisão manual (risco de perda).
   */
  static evaluateStaleUpdate(local: Animal, remote: Animal): ConflictEvaluationResult {
    if (local.status.value !== remote.status.value) {
      return {
        needsReview: true,
        reason: 'A situação do animal mudou nos dois lugares. Revisão manual do responsável é necessária.',
      };
    }
    const localIsNewer = new Date(local.updatedAt) >= new Date(remote.updatedAt);
    return {
      needsReview: false,
      chosenVersion: localIsNewer ? local : remote,
      reason: 'Resolvido automaticamente usando a versão com data de atualização mais recente.',
    };
  }

  static evaluateAnimalConflict(local: Animal, remote: Animal): ConflictEvaluationResult {
    // If local version equals remote version, no conflict
    if (local.version === remote.version) {
      return { needsReview: false, chosenVersion: local };
    }

    // If local has not changed critical status but version differs
    if (local.status.value === remote.status.value) {
      const latest = new Date(local.updatedAt) >= new Date(remote.updatedAt) ? local : remote;
      return {
        needsReview: false,
        chosenVersion: latest,
        reason: 'Resolvido automaticamente usando a versão com data de atualização mais recente.',
      };
    }

    // If both modified status (e.g. local marked adopted vs remote updated data), risk of data loss -> needs user review!
    return {
      needsReview: true,
      reason: 'Conflito de status ou propriedade detectado. Revisão manual do responsável é necessária.',
    };
  }
}
