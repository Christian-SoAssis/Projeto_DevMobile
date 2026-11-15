export type AdoptionStatusType = 'AVAILABLE' | 'ADOPTED';

export class AdoptionStatus {
  public readonly value: AdoptionStatusType;

  constructor(value: AdoptionStatusType = 'AVAILABLE') {
    if (value !== 'AVAILABLE' && value !== 'ADOPTED') {
      throw new Error(`Status de adoção inválido: ${String(value)}`);
    }
    this.value = value;
  }

  static available(): AdoptionStatus {
    return new AdoptionStatus('AVAILABLE');
  }

  static adopted(): AdoptionStatus {
    return new AdoptionStatus('ADOPTED');
  }

  isAvailable(): boolean {
    return this.value === 'AVAILABLE';
  }

  isAdopted(): boolean {
    return this.value === 'ADOPTED';
  }

  equals(other: AdoptionStatus): boolean {
    return this.value === other.value;
  }
}
