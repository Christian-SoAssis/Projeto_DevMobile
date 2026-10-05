import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SearchScreen } from '../../src/adapters/screens/SearchScreen';
import { AnimalFormScreen } from '../../src/adapters/screens/AnimalFormScreen';
import { MyAnimalsScreen } from '../../src/adapters/screens/MyAnimalsScreen';
import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { SyncQueueRepositoryFake } from '../../src/application/fakes/SyncQueueRepositoryFake';
import { Animal } from '../../src/domain/entities/Animal';
import { AnimalCharacteristics } from '../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../src/domain/value-objects/ApproximateLocation';

function makeLoc(city = 'Varginha', neighborhood = 'Centro') {
  return new ApproximateLocation({
    latitude: -21.55,
    longitude: -45.43,
    neighborhood,
    city,
    region: 'MG',
  });
}

function makeChar(species: string, size: string, approximateAge: string, sex: string) {
  return new AnimalCharacteristics({ species, size, approximateAge, sex });
}

describe('Mock completion — filtros, edição e gestão', () => {
  describe('SearchScreen filtros RF04 (mock)', () => {
    it('deve filtrar por porte', async () => {
      const repo = new AnimalRepositoryFake([
        new Animal({ id: 'a1', ownerId: 'u1', name: 'Luna', characteristics: makeChar('Cão', 'Médio', '2 anos', 'Fêmea'), location: makeLoc() }),
        new Animal({ id: 'a2', ownerId: 'u1', name: 'Rex', characteristics: makeChar('Cão', 'Grande', '3 anos', 'Macho'), location: makeLoc() }),
      ]);
      const { getByTestId, getByText, queryByText } = render(<SearchScreen animalRepository={repo} />);
      await waitFor(() => expect(getByText('Luna')).toBeTruthy());
      fireEvent.press(getByTestId('filter-size-Grande'));
      await waitFor(() => expect(getByText('Rex')).toBeTruthy());
      expect(queryByText('Luna')).toBeNull();
    });

    it('deve filtrar por sexo', async () => {
      const repo = new AnimalRepositoryFake([
        new Animal({ id: 'a1', ownerId: 'u1', name: 'Luna', characteristics: makeChar('Gato', 'Pequeno', '1 ano', 'Fêmea'), location: makeLoc() }),
        new Animal({ id: 'a2', ownerId: 'u1', name: 'Rex', characteristics: makeChar('Gato', 'Pequeno', '1 ano', 'Macho'), location: makeLoc() }),
      ]);
      const { getByTestId, getByText, queryByText } = render(<SearchScreen animalRepository={repo} />);
      await waitFor(() => expect(getByText('Luna')).toBeTruthy());
      fireEvent.press(getByTestId('filter-sex-Macho'));
      await waitFor(() => expect(getByText('Rex')).toBeTruthy());
      expect(queryByText('Luna')).toBeNull();
    });

    it('deve filtrar por idade aproximada (contains)', async () => {
      const repo = new AnimalRepositoryFake([
        new Animal({ id: 'a1', ownerId: 'u1', name: 'Luna', characteristics: makeChar('Cão', 'Médio', '2 anos', 'Fêmea'), location: makeLoc() }),
        new Animal({ id: 'a2', ownerId: 'u1', name: 'Totó', characteristics: makeChar('Cão', 'Médio', '5 anos', 'Macho'), location: makeLoc() }),
      ]);
      const { getByTestId, getByText, queryByText } = render(<SearchScreen animalRepository={repo} />);
      await waitFor(() => expect(getByText('Luna')).toBeTruthy());
      fireEvent.changeText(getByTestId('search-age-input'), '5 anos');
      fireEvent.press(getByTestId('search-age-button'));
      await waitFor(() => expect(getByText('Totó')).toBeTruthy());
      expect(queryByText('Luna')).toBeNull();
    });
  });

  describe('AnimalFormScreen modo edição (mock)', () => {
    it('deve pré-preencher e atualizar anúncio do proprietário', async () => {
      const animal = new Animal({
        id: 'a1',
        ownerId: 'usr_1',
        name: 'Luna',
        characteristics: makeChar('Cão', 'Médio', '2 anos', 'Fêmea'),
        location: makeLoc(),
      });
      const repo = new AnimalRepositoryFake([animal]);
      const queue = new SyncQueueRepositoryFake();
      const onSuccess = jest.fn();
      const { getByTestId, getByText } = render(
        <AnimalFormScreen
          ownerId="usr_1"
          initialAnimal={animal}
          animalRepository={repo}
          syncQueueRepository={queue}
          onSuccess={onSuccess}
        />
      );
      expect(getByTestId('form-title').props.children).toBe('Editar Anúncio');
      fireEvent.changeText(getByTestId('input-name'), 'Luna Nova');
      fireEvent.press(getByTestId('btn-submit-animal'));
      await waitFor(() => {
        expect(getByText('Anúncio atualizado com sucesso!')).toBeTruthy();
      });
      expect(onSuccess).toHaveBeenCalled();
      expect((await repo.findById('a1'))?.name).toBe('Luna Nova');
    });

    it('deve rejeitar edição por não proprietário', async () => {
      const animal = new Animal({
        id: 'a1',
        ownerId: 'usr_1',
        name: 'Luna',
        characteristics: makeChar('Cão', 'Médio', '2 anos', 'Fêmea'),
        location: makeLoc(),
      });
      const repo = new AnimalRepositoryFake([animal]);
      const { getByTestId, getByText } = render(
        <AnimalFormScreen
          ownerId="usr_2"
          initialAnimal={animal}
          animalRepository={repo}
          syncQueueRepository={new SyncQueueRepositoryFake()}
        />
      );
      fireEvent.changeText(getByTestId('input-name'), 'Invasão');
      fireEvent.press(getByTestId('btn-submit-animal'));
      await waitFor(() => {
        expect(getByText('Somente o responsável pelo anúncio pode alterar seus dados.')).toBeTruthy();
      });
    });
  });

  describe('MyAnimalsScreen gestão (mock)', () => {
    it('deve chamar onEditAnimal ao pressionar Editar', async () => {
      const mine = new Animal({ id: 'a1', ownerId: 'u1', name: 'Luna', characteristics: makeChar('Cão', 'Médio', '2 anos', 'Fêmea'), location: makeLoc() });
      const repo = new AnimalRepositoryFake([mine]);
      const onEdit = jest.fn();
      const { getByTestId } = render(
        <MyAnimalsScreen animalRepository={repo} ownerId="u1" onEditAnimal={onEdit} />
      );
      await waitFor(() => expect(getByTestId('my-animal-item-a1')).toBeTruthy());
      fireEvent.press(getByTestId('my-animal-edit-a1'));
      expect(onEdit).toHaveBeenCalledWith(mine);
    });

    it('deve marcar como adotado e exibir feedback', async () => {
      const mine = new Animal({ id: 'a1', ownerId: 'u1', name: 'Luna', characteristics: makeChar('Cão', 'Médio', '2 anos', 'Fêmea'), location: makeLoc() });
      const repo = new AnimalRepositoryFake([mine]);
      const { getByTestId, getByText } = render(
        <MyAnimalsScreen
          animalRepository={repo}
          syncQueueRepository={new SyncQueueRepositoryFake()}
          ownerId="u1"
        />
      );
      await waitFor(() => expect(getByTestId('my-animal-adopted-a1')).toBeTruthy());
      fireEvent.press(getByTestId('my-animal-adopted-a1'));
      await waitFor(() => {
        expect(getByText('Animal marcado como adotado com sucesso!')).toBeTruthy();
      });
      expect((await repo.findById('a1'))?.status.isAdopted()).toBe(true);
    });

    it('deve excluir anúncio e exibir feedback', async () => {
      const mine = new Animal({ id: 'a1', ownerId: 'u1', name: 'Luna', characteristics: makeChar('Cão', 'Médio', '2 anos', 'Fêmea'), location: makeLoc() });
      const repo = new AnimalRepositoryFake([mine]);
      const { getByTestId, getByText } = render(
        <MyAnimalsScreen
          animalRepository={repo}
          syncQueueRepository={new SyncQueueRepositoryFake()}
          ownerId="u1"
        />
      );
      await waitFor(() => expect(getByTestId('my-animal-delete-a1')).toBeTruthy());
      fireEvent.press(getByTestId('my-animal-delete-a1'));
      await waitFor(() => {
        expect(getByText('Anúncio excluído com sucesso!')).toBeTruthy();
      });
      expect(await repo.findById('a1')).toBeNull();
    });
  });
});
