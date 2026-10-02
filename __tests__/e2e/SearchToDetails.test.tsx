import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => ({ id: 'anim_1' }),
}));

import HomeTab from '../../app/(tabs)/index';
import AnimalDetailsRoute from '../../app/animal/[id]';

describe('E2E — Visitante pesquisa e abre um animal (doc §16.4 item 1)', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockBack.mockClear();
  });

  it('deve pesquisar na busca e navegar para os detalhes do animal', async () => {
    const { getByTestId, getByText } = render(<HomeTab />);

    await waitFor(() => {
      expect(getByText('Luna')).toBeTruthy();
    });

    fireEvent.press(getByTestId('animal-card-anim_1'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/animal/[id]',
      params: { id: 'anim_1' },
    });
  });

  it('deve abrir os detalhes do animal pelo id da rota', async () => {
    const { getByTestId } = render(<AnimalDetailsRoute />);

    await waitFor(() => {
      expect(getByTestId('animal-details-screen')).toBeTruthy();
    });
    expect(getByTestId('animal-title').props.children).toBe('Luna');
  });
});
