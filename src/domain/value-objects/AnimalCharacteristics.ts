export interface AnimalCharacteristicsProps {
  species: 'Cão' | 'Gato' | 'Outro' | string;
  size: 'Pequeno' | 'Médio' | 'Grande' | string;
  approximateAge: string;
  sex: 'Macho' | 'Fêmea' | string;
  characteristics?: string;
  behavior?: string;
  specialCare?: string;
}

export class AnimalCharacteristics {
  readonly species: string;
  readonly size: string;
  readonly approximateAge: string;
  readonly sex: string;
  readonly characteristics: string;
  readonly behavior: string;
  readonly specialCare: string;

  constructor(props: AnimalCharacteristicsProps) {
    if (!props.species || props.species.trim().length === 0) {
      throw new Error('Espécie é obrigatória.');
    }
    if (!props.size || props.size.trim().length === 0) {
      throw new Error('Porte é obrigatório.');
    }
    if (!props.approximateAge || props.approximateAge.trim().length === 0) {
      throw new Error('Idade aproximada é obrigatória.');
    }
    if (!props.sex || props.sex.trim().length === 0) {
      throw new Error('Sexo é obrigatório.');
    }

    this.species = props.species.trim();
    this.size = props.size.trim();
    this.approximateAge = props.approximateAge.trim();
    this.sex = props.sex.trim();
    this.characteristics = props.characteristics?.trim() || '';
    this.behavior = props.behavior?.trim() || '';
    this.specialCare = props.specialCare?.trim() || 'Nenhum';
  }

  summary(): string {
    return `${this.species} • ${this.size} • ${this.approximateAge} • ${this.sex}`;
  }
}
