import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { FavoritesScreen } from '../../src/adapters/screens/FavoritesScreen';
import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { FavoriteRepositoryFake } from '../../src/application/fakes/FavoriteRepositoryFake';
import { Favorite } from '../../src/domain/entities/Favorite';
import { Animal } from '../../src/domain/entities/Animal';
import { AnimalCharacteristics } from '../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../src/domain/value-objects/ApproximateLocation';

describe('FavoritesScreen Component', () => {
  const dummyLoc = new ApproximateLocation({
    latitude: -21.55,
    longitude: -45.43,
    neighborhood: 'Centro',
    city: 'Varginha',
    region: 'MG',
  });
  const dummyChar = new AnimalCharacteristics({
    species: 'Cão',
    size: 'Médio',
    approximateAge: '2 anos',
    sex: 'Fêmea',
  });

  const makeAnimal = (id: string, name: string) =>
    new Animal({ id, ownerId: 'u1', name, characteristics: dummyChar, location: dummyLoc });

  it('deve exibir mensagem de vazio quando não há favoritos', async () => {
    const { getByTestId, getByText } = render(
      <FavoritesScreen
        animalRepository={new AnimalRepositoryFake()}
        favoriteRepository={new FavoriteRepositoryFake()}
        currentUserId="u1"
      />
    );

    await waitFor(() => {
      expect(getByTestId('empty-favorites')).toBeTruthy();
    });
    expect(getByText('Meus Favoritos (0)')).toBeTruthy();
  });

  it('deve listar favoritos do usuário e acionar onSelectAnimal', async () => {
    const animal = makeAnimal('a1', 'Luna');
    const animalRepo = new AnimalRepositoryFake([animal]);
    const favRepo = new FavoriteRepositoryFake();
    await favRepo.addFavorite(new Favorite('u1', 'a1'));
    const onSelectMock = jest.fn();

    const { getByTestId, getByText } = render(
      <FavoritesScreen
        animalRepository={animalRepo}
        favoriteRepository={favRepo}
        currentUserId="u1"
        onSelectAnimal={onSelectMock}
      />
    );

    await waitFor(() => {
      expect(getByText('Luna')).toBeTruthy();
    });
    expect(getByText('Meus Favoritos (1)')).toBeTruthy();

    fireEvent.press(getByTestId('favorite-card-a1'));
    expect(onSelectMock).toHaveBeenCalledWith(animal);
  });
});
