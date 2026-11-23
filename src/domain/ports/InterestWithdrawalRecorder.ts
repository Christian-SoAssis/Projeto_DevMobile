import { AdoptionInterest } from '../entities/AdoptionInterest';

/**
 * Porta de saída de domínio para registrar notificações locais de desistência
 * de interesse de adoção, mantendo a camada de aplicação desacoplada de `adapters`.
 */
export interface InterestWithdrawalRecorder {
  record(ownerId: string, animalName: string, interest: AdoptionInterest): Promise<void>;
}
