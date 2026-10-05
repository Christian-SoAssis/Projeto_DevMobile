import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'anim_1' }),
}));

import EditarAnuncioRoute from '../../app/(protected)/editar-anuncio';
import LoginRoute from '../../app/login';
import CadastroRoute from '../../app/cadastro';

describe('Rotas mock — edição e auth stub', () => {
  it('deve abrir edição pré-preenchida do anúncio da rota', async () => {
    const { getByTestId } = render(<EditarAnuncioRoute />);
    await waitFor(() => {
      expect(getByTestId('animal-form-screen')).toBeTruthy();
    });
    expect(getByTestId('form-title').props.children).toBe('Editar Anúncio');
  });

  it('deve renderizar rota de login (mock)', () => {
    const { getByTestId } = render(<LoginRoute />);
    expect(getByTestId('login-screen')).toBeTruthy();
  });

  it('deve renderizar rota de cadastro (mock)', () => {
    const { getByTestId } = render(<CadastroRoute />);
    expect(getByTestId('register-screen')).toBeTruthy();
  });
});
