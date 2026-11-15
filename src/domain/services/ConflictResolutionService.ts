import { Animal } from '../entities/Animal';

export type ConflictResolutionOutcome =
  | { type: 'AUTO_RESOLVED'; winner: 'LOCAL' | 'REMOTE'; resolvedAnimal: Animal }
  | { type: 'MANUAL_REVIEW_REQUIRED'; localAnimal: Animal; remoteAnimal: Animal; reason: string };

/**
 * Política definitiva de conflito (§14.3, Decisão 15, RF23, RNF03):
 * - Conflito simples (mesmo status de adoção): aplica Last-Write-Wins pelo `updatedAt` mais recente.
 * - Divergência na situação da adoção (`AVAILABLE` vs `ADOPTED`): exige revisão manual do responsável
 *   para evitar perda silenciosa de informação relevante.
 */
export class ConflictResolutionService {
  evaluate(localAnimal: Animal, remoteAnimal: Animal): ConflictResolutionOutcome {
    if (!localAnimal.status.equals(remoteAnimal.status)) {
      return {
        type: 'MANUAL_REVIEW_REQUIRED',
        localAnimal,
        remoteAnimal,
        reason:
          'A situação da adoção mudou nos dois aparelhos (Disponível vs. Adotado). Escolha qual versão manter.',
      };
    }

    const localTime = Date.parse(localAnimal.updatedAt) || 0;
    const remoteTime = Date.parse(remoteAnimal.updatedAt) || 0;

    if (localTime >= remoteTime) {
      return {
        type: 'AUTO_RESOLVED',
        winner: 'LOCAL',
        resolvedAnimal: localAnimal,
      };
    }

    return {
      type: 'AUTO_RESOLVED',
      winner: 'REMOTE',
      resolvedAnimal: remoteAnimal,
    };
  }
}
