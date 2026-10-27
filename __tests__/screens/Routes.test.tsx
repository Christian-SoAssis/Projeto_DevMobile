import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { AuthProvider } from '../../src/adapters/context/AuthContext';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ id: 'anim_1' }),
}));

import EditarAnuncioRoute from '../../app/(protected)/editar-anuncio';
import LoginRoute from '../../app/login';
import CadastroRoute from '../../app/cadastro';

const withAuth = (ui: React.ReactElement) => render(<AuthProvider>{ui}</AuthProvider>);

describe('Rotas mock — edição e auth stub', () => {
  it('deve abrir edição pré-preenchida do anúncio da rota', async () => {
    const { getByTestId } = withAuth(<EditarAnuncioRoute />);
    await waitFor(() => {
      expect(getByTestId('animal-form-screen')).toBeTruthy();
    });
    expect(getByTestId('form-title').props.children).toBe('Editar Anúncio');
  });

  it('deve renderizar rota de login (mock)', async () => {
    const { getByTestId } = withAuth(<LoginRoute />);
    await waitFor(() => expect(getByTestId('login-screen')).toBeTruthy());
  });

  it('deve renderizar rota de cadastro (mock)', async () => {
    const { getByTestId } = withAuth(<CadastroRoute />);
    await waitFor(() => expect(getByTestId('register-screen')).toBeTruthy());
  });
});
