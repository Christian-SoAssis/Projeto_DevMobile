import { AdoptionInterest } from '../entities/AdoptionInterest';
import { InterestStatus } from '../value-objects/InterestStatus';

export interface AdoptionInterestRepository {
  registerInterest(interest: AdoptionInterest): Promise<void>;
  listByUser(userId: string): Promise<AdoptionInterest[]>;
  listByAnimal(animalId: string): Promise<AdoptionInterest[]>;
  hasInterest(userId: string, animalId: string): Promise<boolean>;
  /**
   * Trilha (decisão 18): o responsável faz a manifestação avançar. `updatedAt`
   * marca a hora da mudança — não-flamingo do feed de notificações (#7).
   * Quando a linha não existe localmente (só no servidor), segue no-op:
   * a intenção viaja na fila de sincronização.
   */
  updateStatus(interestId: string, status: InterestStatus, updatedAt: string): Promise<void>;
}
