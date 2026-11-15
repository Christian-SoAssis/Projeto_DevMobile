export interface AnimalCharacteristicsProps {
  species: string;
  size: string;
  approximateAge: string;
  sex: string;
  characteristics?: string;
  behavior?: string;
  specialCare?: string;
}

/**
 * Características do animal (RF04, RF06, Decisão 17).
 * Espécie, porte, idade aproximada e sexo são obrigatórios;
 * características, comportamento e cuidados especiais são opcionais.
 */
export class AnimalCharacteristics {
  public readonly species: string;
  public readonly size: string;
  public readonly approximateAge: string;
  public readonly sex: string;
  public readonly characteristics: string;
  public readonly behavior: string;
  public readonly specialCare: string;

  constructor(props: AnimalCharacteristicsProps) {
    const species = (props.species ?? '').trim();
    const size = (props.size ?? '').trim();
    const approximateAge = (props.approximateAge ?? '').trim();
    const sex = (props.sex ?? '').trim();

    if (!species) throw new Error('A espécie do animal é obrigatória.');
    if (!size) throw new Error('O porte do animal é obrigatório.');
    if (!approximateAge) throw new Error('A idade aproximada do animal é obrigatória.');
    if (!sex) throw new Error('O sexo do animal é obrigatório.');

    this.species = species;
    this.size = size;
    this.approximateAge = approximateAge;
    this.sex = sex;
    this.characteristics = (props.characteristics ?? '').trim();
    this.behavior = (props.behavior ?? '').trim();
    this.specialCare = (props.specialCare ?? '').trim();
  }
}
