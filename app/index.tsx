import React from 'react';
import { SearchScreen } from '../src/adapters/screens/SearchScreen';
import { AnimalRepositoryFake } from '../src/application/fakes/AnimalRepositoryFake';
import { Animal } from '../src/domain/entities/Animal';
import { AnimalCharacteristics } from '../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../src/domain/value-objects/ApproximateLocation';

const initialMockAnimals = [
  new Animal({
    id: 'anim_1',
    ownerId: 'usr_1',
    name: 'Luna',
    characteristics: new AnimalCharacteristics({
      species: 'Cão',
      size: 'Médio',
      approximateAge: '2 anos',
      sex: 'Fêmea',
      behavior: 'Dócil e brincalhona',
    }),
    location: new ApproximateLocation({
      latitude: -21.554,
      longitude: -45.435,
      neighborhood: 'Centro',
      city: 'Varginha',
      region: 'MG',
    }),
  }),
  new Animal({
    id: 'anim_2',
    ownerId: 'usr_1',
    name: 'Mingau',
    characteristics: new AnimalCharacteristics({
      species: 'Gato',
      size: 'Pequeno',
      approximateAge: '1 ano',
      sex: 'Macho',
      behavior: 'Calmo e carinhoso',
    }),
    location: new ApproximateLocation({
      latitude: -21.56,
      longitude: -45.44,
      neighborhood: 'Vila Paiva',
      city: 'Varginha',
      region: 'MG',
    }),
  }),
];

const repository = new AnimalRepositoryFake(initialMockAnimals);

export default function HomeScreen() {
  return <SearchScreen animalRepository={repository} />;
}
