import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AnimalCover } from '../../src/adapters/components/AnimalCover';
import { Animal } from '../../src/domain/entities/Animal';
import { AnimalPhoto } from '../../src/domain/entities/AnimalPhoto';
import { AnimalCharacteristics } from '../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../src/domain/value-objects/ApproximateLocation';

function buildAnimal(withPhoto: boolean): Animal {
  return new Animal({
    id: 'a1',
    ownerId: 'u1',
    name: 'Rex',
    characteristics: new AnimalCharacteristics({
      species: 'Cão',
      size: 'Médio',
      approximateAge: '2 anos',
      sex: 'Macho',
    }),
    location: new ApproximateLocation({
      latitude: -21.55,
      longitude: -45.43,
      neighborhood: 'Centro',
      city: 'Varginha',
      region: 'MG',
    }),
    photos: withPhoto
      ? [new AnimalPhoto({ id: 'p1', animalId: 'a1', remoteUrl: 'https://exemplo.com/rex.jpg' })]
      : [],
  });
}

describe('AnimalCover', () => {
  it('deve exibir a primeira foto do anúncio', () => {
    const { getByTestId } = render(<AnimalCover animal={buildAnimal(true)} />);
    expect(getByTestId('animal-cover-a1').props.source).toEqual({ uri: 'https://exemplo.com/rex.jpg' });
  });

  it('deve exibir placeholder quando não há foto', () => {
    const { getByTestId } = render(<AnimalCover animal={buildAnimal(false)} />);
    expect(getByTestId('animal-cover-placeholder-a1')).toBeTruthy();
  });

  it('deve trocar para placeholder se a imagem falhar ao carregar', () => {
    const { getByTestId } = render(<AnimalCover animal={buildAnimal(true)} />);
    fireEvent(getByTestId('animal-cover-a1'), 'error');
    expect(getByTestId('animal-cover-placeholder-a1')).toBeTruthy();
  });
});
