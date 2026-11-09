import { InterestStatus } from '../value-objects/InterestStatus';

export class AdoptionInterest {
  readonly id: string;
  readonly userId: string;
  readonly animalId: string;
  readonly createdAt: string;
  /** Etapa na trilha de adoção (decisão 18: ENVIADA → … → CONCLUÍDA; recusa = folha). */
  readonly status: InterestStatus;
  /** Quando o status mudou por último (base das notificações “sua manifestação avançou”). */
  readonly updatedAt: string;

  constructor(
    id: string,
    userId: string,
    animalId: string,
    createdAt?: string,
    status?: InterestStatus,
    updatedAt?: string
  ) {
    if (!id) throw new Error('ID do interesse é obrigatório.');
    if (!userId) throw new Error('ID do usuário é obrigatório.');
    if (!animalId) throw new Error('ID do animal é obrigatório.');

    this.id = id;
    this.userId = userId;
    this.animalId = animalId;
    this.createdAt = createdAt || new Date().toISOString();
    this.status = status || InterestStatus.enviada();
    this.updatedAt = updatedAt || this.createdAt;
  }

  /** Nova manifestação com a etapa alterada — a mudança fica POR CONTA DO RESPONSÁVEL. */
  withStatus(next: InterestStatus, changedAt: string): AdoptionInterest {
    return new AdoptionInterest(this.id, this.userId, this.animalId, this.createdAt, next, changedAt);
  }
}
