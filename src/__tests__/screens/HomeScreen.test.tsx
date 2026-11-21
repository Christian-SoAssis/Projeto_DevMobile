import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import HomeScreen from '../../../app/(tabs)/index';
import { mockRepositories } from '../mocks/RepositoriesContext.mock';
import { mockAuth } from '../mocks/AuthContext.mock';
import { mockRouter } from '../mocks/expo-router.mock';
import { createTestAnimal } from '../fakes/in-memory-repositories';

describe('HomeScreen (RNTL)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.user = null;
    mockRepositories.animalRepository.search.mockResolvedValue([]);
    mockRepositories.syncQueueRepository.listPending.mockResolvedValue([]);
    mockRepositories.favoriteRepository.listByUser.mockResolvedValue([]);
  });

  it('deve renderizar a estrutura da tela inicial com busca e chips de espécie', async () => {
    const { getByText, getByPlaceholderText } = await render(<HomeScreen />);

    expect(getByText(/Encontre seu/)).toBeTruthy();
    expect(getByPlaceholderText('Nome ou cidade')).toBeTruthy();
    expect(getByText('Todos')).toBeTruthy();
    expect(getByText('Cães')).toBeTruthy();
    expect(getByText('Gatos')).toBeTruthy();
    expect(getByText('Dados atualizados')).toBeTruthy();
  });

  it('deve exibir mensagem de nenhum pet encontrado quando a lista estiver vazia', async () => {
    mockRepositories.animalRepository.search.mockResolvedValue([]);

    const { findByText } = await render(<HomeScreen />);

    expect(await findByText('Nenhum pet encontrado')).toBeTruthy();
    expect(
      await findByText('Tente limpar os filtros ou buscar por outro bairro/cidade.')
    ).toBeTruthy();
  });

  it('deve listar os animais retornados pelo repositório', async () => {
    const animal1 = createTestAnimal({ id: 'pet-1', name: 'Pipoca', species: 'Cão' });
    const animal2 = createTestAnimal({ id: 'pet-2', name: 'Mimi', species: 'Gato' });

    mockRepositories.animalRepository.search.mockResolvedValue([animal1, animal2]);

    const { findByText } = await render(<HomeScreen />);

    expect(await findByText('Pipoca')).toBeTruthy();
    expect(await findByText('Mimi')).toBeTruthy();
  });

  it('deve navegar para a tela de detalhes ao tocar no card do animal', async () => {
    const animal = createTestAnimal({ id: 'animal-xyz', name: 'Bidu' });
    mockRepositories.animalRepository.search.mockResolvedValue([animal]);

    const { findByText } = await render(<HomeScreen />);

    const animalCard = await findByText('Bidu');
    await fireEvent.press(animalCard);

    expect(mockRouter.push).toHaveBeenCalledWith('/animal/animal-xyz');
  });

  it('deve redirecionar para tela de login ao tentar favoritar sem estar autenticado', async () => {
    mockAuth.user = null;
    const animal = createTestAnimal({ id: 'pet-99', name: 'Bob' });
    mockRepositories.animalRepository.search.mockResolvedValue([animal]);

    const { findByLabelText } = await render(<HomeScreen />);

    const favoriteBtn = await findByLabelText('Favoritar anúncio');
    await fireEvent.press(favoriteBtn);

    expect(mockRouter.push).toHaveBeenCalledWith('/(public)/login');
  });

  it('deve alternar entre a visualização de Lista e Mapa', async () => {
    const { getByText, findByText, queryByText } = await render(<HomeScreen />);

    expect(getByText('Lista')).toBeTruthy();
    expect(getByText('Mapa')).toBeTruthy();

    await fireEvent.press(getByText('Mapa'));

    // No modo mapa, o headline da lista não é exibido
    expect(queryByText(/Encontre seu/)).toBeNull();

    await fireEvent.press(getByText('Lista'));
    expect(await findByText(/Encontre seu/)).toBeTruthy();
  });

  it('deve filtrar por espécie ao tocar no chip de Cães', async () => {
    const { getByText } = await render(<HomeScreen />);

    await fireEvent.press(getByText('Cães'));

    await waitFor(() => {
      expect(mockRepositories.animalRepository.search).toHaveBeenCalledWith(
        expect.objectContaining({
          species: 'Cão',
        })
      );
    });
  });

  it('deve filtrar animais ao digitar na barra de pesquisa', async () => {
    const { getByPlaceholderText } = await render(<HomeScreen />);

    const searchInput = getByPlaceholderText('Nome ou cidade');
    await fireEvent.changeText(searchInput, 'Amora');

    await waitFor(() => {
      expect(mockRepositories.animalRepository.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'Amora',
        })
      );
    });
  });

  it('deve disparar recarga de dados ao acionar o pull-to-refresh (RefreshControl)', async () => {
    const animal = createTestAnimal({ id: 'pet-refresh', name: 'Fred' });
    mockRepositories.animalRepository.search.mockResolvedValue([animal]);

    const { getByTestId } = await render(<HomeScreen />);

    const refreshControl = getByTestId('feed-refresh-control');
    expect(refreshControl).toBeTruthy();

    await fireEvent(refreshControl, 'refresh');

    await waitFor(() => {
      expect(mockRepositories.animalRepository.search).toHaveBeenCalled();
    });
  });
});
