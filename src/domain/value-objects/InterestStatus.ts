/**
 * Etapa da trilha de adoção da manifestação de interesse (decisão de produto
 * 08/11/2026 — doc §18 decisão 18).
 *
 * Trilha oficial (4 etapas): ENVIADA → EM_ANALISE → VISITA_COMBINADA → CONCLUIDA.
 * RECUSADA existe FORA da trilha (folha — não conta como passo).
 * O valor legado `PENDING` (default antigo da coluna SQLite) mapeia para ENVIADA.
 *
 * Tokens ASCII para a persistência; rótulos com acento são da camada de UI.
 */

export type InterestStatusType =
  | 'ENVIADA'
  | 'EM_ANALISE'
  | 'VISITA_COMBINADA'
  | 'CONCLUIDA'
  | 'RECUSADA';

/** Ordem da trilha (4 etapas). RECUSADA está fora dela. */
export const INTEREST_TRAIL: readonly InterestStatusType[] = [
  'ENVIADA',
  'EM_ANALISE',
  'VISITA_COMBINADA',
  'CONCLUIDA',
];

export class InterestStatus {
  readonly value: InterestStatusType;

  private constructor(value: InterestStatusType) {
    this.value = value;
  }

  // Valores legados/ausentes decaem para ENVIADA (manto da tela, nunca quebra).
  static from(value: string | null | undefined): InterestStatus {
    if (!value || value === 'PENDING' || value === 'ENVIADA') return new InterestStatus('ENVIADA');
    if (value === 'EM_ANALISE') return new InterestStatus('EM_ANALISE');
    if (value === 'VISITA_COMBINADA') return new InterestStatus('VISITA_COMBINADA');
    if (value === 'CONCLUIDA') return new InterestStatus('CONCLUIDA');
    if (value === 'RECUSADA') return new InterestStatus('RECUSADA');
    return new InterestStatus('ENVIADA');
  }

  static enviada(): InterestStatus {
    return new InterestStatus('ENVIADA');
  }

  static emAnalise(): InterestStatus {
    return new InterestStatus('EM_ANALISE');
  }

  static visitaCombinada(): InterestStatus {
    return new InterestStatus('VISITA_COMBINADA');
  }

  static concluida(): InterestStatus {
    return new InterestStatus('CONCLUIDA');
  }

  static recusada(): InterestStatus {
    return new InterestStatus('RECUSADA');
  }

  equals(other: InterestStatus): boolean {
    return this.value === other.value;
  }

  isRecusada(): boolean {
    return this.value === 'RECUSADA';
  }

  isConcluida(): boolean {
    return this.value === 'CONCLUIDA';
  }

  /** 0..3 dentro da trilha; RECUSADA = -1 (fora do progresso). */
  stepIndex(): number {
    return INTEREST_TRAIL.indexOf(this.value);
  }

  /** Próxima etapa da trilha; CONCLUIDA e RECUSADA não avançam. */
  nextInTrail(): InterestStatus | null {
    const index = this.stepIndex();
    if (index < 0 || index >= INTEREST_TRAIL.length - 1) return null;
    return InterestStatus.from(INTEREST_TRAIL[index + 1]);
  }
}
