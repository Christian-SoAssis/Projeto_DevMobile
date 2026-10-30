import { Animal } from '../src/domain/entities/Animal';
import { AnimalPhoto } from '../src/domain/entities/AnimalPhoto';
import { AnimalCharacteristics } from '../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../src/domain/value-objects/ApproximateLocation';

export function makeCharacteristics(
  overrides: Partial<ConstructorParameters<typeof AnimalCharacteristics>[0]> = {}
): AnimalCharacteristics {
  return new AnimalCharacteristics({
    species: 'Cão',
    size: 'Médio',
    approximateAge: '2 anos',
    sex: 'Fêmea',
    characteristics: 'Dócil e brincalhona',
    behavior: 'Convive bem com crianças',
    specialCare: 'Nenhum',
    ...overrides,
  });
}

export function makeLocation(
  overrides: Partial<ConstructorParameters<typeof ApproximateLocation>[0]> = {}
): ApproximateLocation {
  return new ApproximateLocation({
    latitude: -21.554,
    longitude: -45.43,
    neighborhood: 'Centro',
    city: 'Varginha',
    region: 'MG',
    ...overrides,
  });
}

export function makeAnimal(overrides: Partial<ConstructorParameters<typeof Animal>[0]> = {}): Animal {
  return new Animal({
    id: 'animal_1',
    ownerId: 'user_1',
    name: 'Luna',
    characteristics: makeCharacteristics(),
    location: makeLocation(),
    ...overrides,
  });
}

export function makePhoto(overrides: Partial<ConstructorParameters<typeof AnimalPhoto>[0]> = {}): AnimalPhoto {
  return new AnimalPhoto({
    id: 'photo_1',
    animalId: 'animal_1',
    localPath: 'file:///tmp/photo_1.jpg',
    ...overrides,
  });
}
