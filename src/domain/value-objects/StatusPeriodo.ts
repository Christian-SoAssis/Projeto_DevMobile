export type StatusPeriodoType = 'RASCUNHO' | 'EM_ANALISE' | 'APROVADO' | 'DEVOLVIDO';

export class StatusPeriodo {
  readonly value: StatusPeriodoType;

  constructor(value: StatusPeriodoType) {
    const valid: StatusPeriodoType[] = ['RASCUNHO', 'EM_ANALISE', 'APROVADO', 'DEVOLVIDO'];
    if (!valid.includes(value)) {
      throw new Error(`Status de período inválido: ${value}`);
    }
    this.value = value;
  }

  isAprovado(): boolean {
    return this.value === 'APROVADO';
  }

  isRascunho(): boolean {
    return this.value === 'RASCUNHO';
  }

  isDevolvido(): boolean {
    return this.value === 'DEVOLVIDO';
  }
}
