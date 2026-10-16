import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SearchScreen } from '../../src/adapters/screens/SearchScreen';
import { AnimalDetailsScreen } from '../../src/adapters/screens/AnimalDetailsScreen';
import { AnimalFormScreen } from '../../src/adapters/screens/AnimalFormScreen';
import { SyncStatusScreen } from '../../src/adapters/screens/SyncStatusScreen';

import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { SyncQueueRepositoryFake } from '../../src/application/fakes/SyncQueueRepositoryFake';
import { FavoriteRepositoryFake } from '../../src/application/fakes/FavoriteRepositoryFake';
import { AdoptionInterestRepositoryFake } from '../../src/application/fakes/AdoptionInterestRepositoryFake';
import { CameraGatewayFake } from '../../src/application/fakes/CameraGatewayFake';
import { LocationGatewayFake } from '../../src/application/fakes/LocationGatewayFake';

import { Animal } from '../../src/domain/entities/Animal';
import { AnimalPhoto } from '../../src/domain/entities/AnimalPhoto';
import { SyncAction } from '../../src/domain/entities/SyncAction';
import { AnimalCharacteristics } from '../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../src/domain/value-objects/ApproximateLocation';

describe('React Native Screens UI Tests (RNTL)', () => {
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

  describe('SearchScreen Component', () => {
    it('deve renderizar busca, alternar entre lista e mapa, filtrar espécies e acionar onSelectAnimal', async () => {
      const animal1 = new Animal({ id: 'a1', ownerId: 'u1', name: 'Luna', characteristics: dummyChar, location: dummyLoc });
      const repo = new AnimalRepositoryFake([animal1]);
      const onSelectMock = jest.fn();

      const { getByTestId, getByText } = render(
        <SearchScreen animalRepository={repo} isOnlineInitial={true} onSelectAnimal={onSelectMock} />
      );

      await waitFor(() => {
        expect(getByText('Luna')).toBeTruthy();
      });

      expect(getByTestId('connection-banner')).toBeTruthy();

      const input = getByTestId('search-input');
      fireEvent.changeText(input, 'Luna');
      fireEvent.press(getByTestId('filter-chip-Cão'));
      fireEvent.press(getByTestId('filter-chip-Todos'));
      fireEvent.press(getByTestId('toggle-map'));
      await waitFor(() => {
        expect(getByTestId('map-view')).toBeTruthy();
      });

      fireEvent.press(getByTestId('toggle-list'));
      await waitFor(() => {
        expect(getByTestId('animals-list')).toBeTruthy();
      });

      fireEvent.press(getByTestId('animal-card-a1'));
      expect(onSelectMock).toHaveBeenCalledWith(animal1);
    });

    it('deve exibir estado offline quando busca falhar', async () => {
      const repo = new AnimalRepositoryFake();
      repo.search = jest.fn().mockRejectedValue(new Error('Erro de conexão'));

      const { getByTestId, getByText } = render(
        <SearchScreen animalRepository={repo} isOnlineInitial={true} />
      );

      await waitFor(() => {
        expect(getByText(/Modo Offline/)).toBeTruthy();
      });
    });
  });

  describe('AnimalDetailsScreen Component', () => {
    it('deve exibir detalhes do animal e tratar login ausente e navegação onBack', async () => {
      const animal = new Animal({ id: 'a1', ownerId: 'usr_owner', name: 'Rex', characteristics: dummyChar, location: dummyLoc });
      const animalRepo = new AnimalRepositoryFake([animal]);
      const favRepo = new FavoriteRepositoryFake();
      const intrRepo = new AdoptionInterestRepositoryFake();
      const onBackMock = jest.fn();

      const { getByTestId, getByText } = render(
        <AnimalDetailsScreen
          animal={animal}
          currentUserId=""
          animalRepository={animalRepo}
          favoriteRepository={favRepo}
          interestRepository={intrRepo}
          onBack={onBackMock}
        />
      );

      expect(getByText('Rex')).toBeTruthy();
      fireEvent.press(getByTestId('back-button'));
      expect(onBackMock).toHaveBeenCalled();

      fireEvent.press(getByTestId('favorite-button'));
      await waitFor(() => {
        expect(getByText('Faça login para favoritar.')).toBeTruthy();
      });

      fireEvent.press(getByTestId('interest-button'));
      await waitFor(() => {
        expect(getByText('Faça login para demonstrar interesse.')).toBeTruthy();
      });
    });

    it('deve permitir favoritar e demonstrar interesse quando usuário estiver autenticado', async () => {
      const animal = new Animal({ id: 'a1', ownerId: 'usr_owner', name: 'Rex', characteristics: dummyChar, location: dummyLoc });
      const animalRepo = new AnimalRepositoryFake([animal]);
      const favRepo = new FavoriteRepositoryFake();
      const intrRepo = new AdoptionInterestRepositoryFake();

      const { getByTestId, getByText } = render(
        <AnimalDetailsScreen
          animal={animal}
          currentUserId="usr_interessado"
          animalRepository={animalRepo}
          favoriteRepository={favRepo}
          interestRepository={intrRepo}
        />
      );

      fireEvent.press(getByTestId('favorite-button'));
      await waitFor(() => {
        expect(getByText('Adicionado aos favoritos!')).toBeTruthy();
      });

      fireEvent.press(getByTestId('interest-button'));
      await waitFor(() => {
        expect(getByText('Manifestação de interesse enviada ao responsável!')).toBeTruthy();
      });
    });

    it('deve exibir botão Marcar como Adotado para o proprietário e permitir exportar PDF', async () => {
      const animal = new Animal({ id: 'a1', ownerId: 'usr_owner', name: 'Rex', characteristics: dummyChar, location: dummyLoc });
      animal.addPhoto(new AnimalPhoto({ id: 'p1', animalId: 'a1', localPath: 'file://p1.jpg' }));
      const animalRepo = new AnimalRepositoryFake([animal]);

      const { getByTestId, getByText } = render(
        <AnimalDetailsScreen
          animal={animal}
          currentUserId="usr_owner"
          animalRepository={animalRepo}
        />
      );

      const btn = getByTestId('mark-adopted-button');
      expect(btn).toBeTruthy();

      fireEvent.press(btn);
      await waitFor(() => {
        expect(getByText('Animal marcado como adotado com sucesso!')).toBeTruthy();
      });

      fireEvent.press(getByTestId('export-pdf-button'));
      await waitFor(() => {
        expect(getByText(/PDF gerado com sucesso/)).toBeTruthy();
      });
    });

    it('deve tratar erro ao marcar como adotado ou ao tentar gerar PDF sem fotos', async () => {
      const animal = new Animal({ id: 'a1', ownerId: 'usr_owner', name: 'Rex', characteristics: dummyChar, location: dummyLoc });
      const animalRepo = new AnimalRepositoryFake([animal]);
      animalRepo.saveLocal = jest.fn().mockRejectedValue(new Error('Erro no SQLite local'));

      const { getByTestId, getByText } = render(
        <AnimalDetailsScreen
          animal={animal}
          currentUserId="usr_owner"
          animalRepository={animalRepo}
        />
      );

      fireEvent.press(getByTestId('mark-adopted-button'));
      await waitFor(() => {
        expect(getByText('Erro no SQLite local')).toBeTruthy();
      });

      fireEvent.press(getByTestId('export-pdf-button'));
      await waitFor(() => {
        expect(getByText('Não é possível gerar PDF para este animal: informações incompletas.')).toBeTruthy();
      });
    });
  });

  describe('AnimalFormScreen Component', () => {
    it('deve preencher formulário, acionar câmera e localização, e salvar anúncio online/offline', async () => {
      const animalRepo = new AnimalRepositoryFake();
      const queueRepo = new SyncQueueRepositoryFake();
      const cameraGateway = new CameraGatewayFake();
      const locationGateway = new LocationGatewayFake();
      const onSuccessMock = jest.fn();

      const { getByTestId, getByText } = render(
        <AnimalFormScreen
          animalRepository={animalRepo}
          syncQueueRepository={queueRepo}
          cameraGateway={cameraGateway}
          locationGateway={locationGateway}
          isOnline={true}
          onSuccess={onSuccessMock}
        />
      );

      fireEvent.changeText(getByTestId('input-name'), 'Thor');
      fireEvent.press(getByTestId('radio-species-Cão'));
      fireEvent.changeText(getByTestId('input-size'), 'Grande');
      fireEvent.changeText(getByTestId('input-age'), '3 anos');

      fireEvent.press(getByTestId('btn-capture-photo'));
      await waitFor(() => {
        expect(getByTestId('photo-status')).toBeTruthy();
      });

      fireEvent.press(getByTestId('btn-capture-location'));
      await waitFor(() => {
        expect(getByTestId('location-status')).toBeTruthy();
      });

      fireEvent.press(getByTestId('btn-submit-animal'));
      await waitFor(() => {
        expect(getByText(/Anúncio cadastrado e sincronizado remotamente!/)).toBeTruthy();
      });
      expect(onSuccessMock).toHaveBeenCalled();
    });

    it('deve salvar localmente quando estiver offline (isOnline=false)', async () => {
      const animalRepo = new AnimalRepositoryFake();
      const queueRepo = new SyncQueueRepositoryFake();

      const { getByTestId, getByText } = render(
        <AnimalFormScreen
          animalRepository={animalRepo}
          syncQueueRepository={queueRepo}
          isOnline={false}
        />
      );

      fireEvent.changeText(getByTestId('input-name'), 'Thor Offline');
      fireEvent.press(getByTestId('btn-submit-animal'));
      await waitFor(() => {
        expect(getByText(/Anúncio salvo localmente/)).toBeTruthy();
      });
    });

    it('deve tratar erro na validação do formulário', async () => {
      const animalRepo = new AnimalRepositoryFake();
      const queueRepo = new SyncQueueRepositoryFake();

      const { getByTestId, getByText } = render(
        <AnimalFormScreen
          animalRepository={animalRepo}
          syncQueueRepository={queueRepo}
        />
      );

      fireEvent.changeText(getByTestId('input-name'), '');
      fireEvent.press(getByTestId('btn-submit-animal'));
      await waitFor(() => {
        expect(getByText('Nome do animal é obrigatório.')).toBeTruthy();
      });
    });
  });

  describe('SyncStatusScreen Component', () => {
    it('deve renderizar SyncStatusScreen com props padrão', async () => {
      const { getByTestId } = render(<SyncStatusScreen />);
      expect(getByTestId('sync-status-screen')).toBeTruthy();
    });

    it('deve exibir lista de itens pendentes e acionar sincronização manual', async () => {
      const animalRepo = new AnimalRepositoryFake();
      const queueRepo = new SyncQueueRepositoryFake();

      const action = new SyncAction({
        id: 's_failed',
        operation: 'UPDATE',
        entityType: 'animal',
        entityId: 'a1',
        payload: {},
        lastError: 'Conexão rejeitada',
      });
      await queueRepo.enqueue(action);

      const { getByTestId, getByText } = render(
        <SyncStatusScreen animalRepository={animalRepo} syncQueueRepository={queueRepo} />
      );

      await waitFor(() => {
        expect(getByText(/Conexão rejeitada/)).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByTestId('btn-trigger-sync'));
      });
      await waitFor(() => {
        expect(getByTestId('sync-result-banner')).toBeTruthy();
      });
    });
  });
});
