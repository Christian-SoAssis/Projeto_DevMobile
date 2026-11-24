import { generateUuid } from '../services/IdGenerator';

/**
 * Decisão 18 (08/11/2026): Trilha de adoção em 4 etapas + RECUSADA fora da trilha.
 * Valor legado `PENDING` mapeia para `ENVIADA`.
 */
export type InterestStage =
  | 'ENVIADA'
  | 'EM_ANALISE'
  | 'VISITA_COMBINADA'
  | 'CONCLUIDA'
  | 'RECUSADA';

export const INTEREST_PIPELINE_STEPS: InterestStage[] = [
  'ENVIADA',
  'EM_ANALISE',
  'VISITA_COMBINADA',
  'CONCLUIDA',
];

/**
 * Retorna as etapas intermediárias (excluindo `from`) entre `from` e `to` na trilha de adoção.
 * Útil para suavizar um pulo de etapa (ex: ENVIADA -> CONCLUIDA) em passos que o servidor
 * aceita individualmente (ENVIADA -> EM_ANALISE -> VISITA_COMBINADA -> CONCLUIDA).
 * RETORNA VAZIO quando `to` está fora da trilha (ex: RECUSADA) ou não há intermediárias.
 */
export function pipelineStepsBetween(from: InterestStage, to: InterestStage): InterestStage[] {
  if (from === to || !INTEREST_PIPELINE_STEPS.includes(from) || !INTEREST_PIPELINE_STEPS.includes(to)) {
    return [];
  }
  const fromIndex = INTEREST_PIPELINE_STEPS.indexOf(from);
  const toIndex = INTEREST_PIPELINE_STEPS.indexOf(to);
  if (toIndex <= fromIndex) return [];
  return INTEREST_PIPELINE_STEPS.slice(fromIndex + 1, toIndex);
}

export function normalizeInterestStage(raw?: string | null): InterestStage {
  if (!raw || raw === 'PENDING' || raw === 'ENVIADA') return 'ENVIADA';
  if (raw === 'EM_ANALISE') return 'EM_ANALISE';
  if (raw === 'VISITA_COMBINADA') return 'VISITA_COMBINADA';
  if (raw === 'CONCLUIDA') return 'CONCLUIDA';
  if (raw === 'RECUSADA') return 'RECUSADA';
  return 'ENVIADA';
}

export interface AdoptionInterestProps {
  id?: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  animalId: string;
  message?: string;
  contactInfo?: string;
  status?: InterestStage | 'PENDING';
  createdAt?: string;
  updatedAt?: string;
}

export class AdoptionInterest {
  public readonly id: string;
  public readonly userId: string;
  public readonly userName?: string;
  public readonly userEmail?: string;
  public readonly animalId: string;
  public readonly message: string;
  public readonly contactInfo: string;
  private _status: InterestStage;
  public readonly createdAt: string;
  private _updatedAt: string;

  constructor(props: AdoptionInterestProps) {
    if (!props.userId || !props.animalId) {
      throw new Error('Manifestação de interesse exige usuário e animal válidos.');
    }
    const cleanMessage = (props.message ?? '').trim();
    if (cleanMessage.length > 400) {
      throw new Error('A mensagem de interesse deve ter no máximo 400 caracteres.');
    }
    this.id = props.id ?? generateUuid();
    this.userId = props.userId;
    this.userName = props.userName;
    this.userEmail = props.userEmail;
    this.animalId = props.animalId;
    this.message = cleanMessage;
    this.contactInfo = (props.contactInfo ?? '').trim();
    this._status = normalizeInterestStage(props.status);
    const now = new Date().toISOString();
    this.createdAt = props.createdAt ?? now;
    this._updatedAt = props.updatedAt ?? now;
  }

  get status(): InterestStage {
    return this._status;
  }

  get updatedAt(): string {
    return this._updatedAt;
  }

  /** Avança ou recusa a manifestação conforme regras da Decisão 18. */
  transitionTo(next: InterestStage): void {
    if (next === 'RECUSADA') {
      if (this._status === 'VISITA_COMBINADA' || this._status === 'CONCLUIDA') {
        throw new Error('Não é permitido recusar após a visita combinada ou conclusão.');
      }
      this._status = 'RECUSADA';
      this._updatedAt = new Date().toISOString();
      return;
    }
    this._status = next;
    this._updatedAt = new Date().toISOString();
  }
}
