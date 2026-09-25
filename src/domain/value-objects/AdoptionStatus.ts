export type AdoptionStatusType = 'AVAILABLE' | 'ADOPTED';

export class AdoptionStatus {
  readonly value: AdoptionStatusType;

  constructor(value: AdoptionStatusType) {
    if (value !== 'AVAILABLE' && value !== 'ADOPTED') {
      throw new Error(`Status de adoção inválido: ${value}`);
    }
    this.value = value;
  }

  isAvailable(): boolean {
    return this.value === 'AVAILABLE';
  }

  isAdopted(): boolean {
    return this.value === 'ADOPTED';
  }

  static available(): AdoptionStatus {
    return new AdoptionStatus('AVAILABLE');
  }

  static adopted(): AdoptionStatus {
    return new AdoptionStatus('ADOPTED');
  }
}
