import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { MyAnimalsScreen } from '../../src/adapters/screens/MyAnimalsScreen';
import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { Animal } from '../../src/domain/entities/Animal';
import { AnimalCharacteristics } from '../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../src/domain/value-objects/ApproximateLocation';

describe('MyAnimalsScreen Component', () => {
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

  it('deve exibir mensagem de vazio quando o responsável não tem anúncios', async () => {
    const { getByTestId, getByText } = render(
      <MyAnimalsScreen animalRepository={new AnimalRepositoryFake()} ownerId="u9" />
    );

    await waitFor(() => {
      expect(getByTestId('empty-my-animals')).toBeTruthy();
    });
    expect(getByText('Meus Anúncios (0)')).toBeTruthy();
  });

  it('deve listar apenas os anúncios do responsável e navegar', async () => {
    const mine = new Animal({ id: 'a1', ownerId: 'u1', name: 'Luna', characteristics: dummyChar, location: dummyLoc });
    const other = new Animal({ id: 'a2', ownerId: 'u2', name: 'Rex', characteristics: dummyChar, location: dummyLoc });
    const repo = new AnimalRepositoryFake([mine, other]);
    const onSelectMock = jest.fn();
    const onNewMock = jest.fn();

    const { getByTestId, getByText, queryByText } = render(
      <MyAnimalsScreen
        animalRepository={repo}
        ownerId="u1"
        onSelectAnimal={onSelectMock}
        onNewAnimal={onNewMock}
      />
    );

    await waitFor(() => {
      expect(getByText('Luna')).toBeTruthy();
    });
    expect(queryByText('Rex')).toBeNull();
    expect(getByText('Meus Anúncios (1)')).toBeTruthy();

    fireEvent.press(getByTestId('my-animal-card-a1'));
    expect(onSelectMock).toHaveBeenCalledWith(mine);

    fireEvent.press(getByTestId('new-animal-button'));
    expect(onNewMock).toHaveBeenCalled();
  });
});
