import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'anim_1' }),
  Redirect: () => null,
}));

import EditarAnuncioRoute from '../../app/(protected)/editar-anuncio';
import { SessionStorageFake } from '../../src/application/fakes/SessionStorageFake';
import { AuthProvider } from '../../src/adapters/context/AuthContext';
import LoginRoute from '../../app/login';
import CadastroRoute from '../../app/cadastro';

describe('Rotas mock — edição e auth stub', () => {
  it('deve abrir edição pré-preenchida do anúncio da rota', async () => {
    // Sessão existente: o fake restaura a Ana (usr_1), dona de anim_1.
    const storage = new SessionStorageFake();
    await storage.saveSessionToken('token');
    const { getByTestId } = await render(
      <AuthProvider sessionStorage={storage}>
        <EditarAnuncioRoute />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(getByTestId('animal-form-screen')).toBeTruthy();
    });
    expect(getByTestId('form-title').props.children).toBe('Editar Anúncio');
  });

  it('visitante na edição não vê o formulário (guarda de rota)', async () => {
    const { queryByTestId } = await render(
      <AuthProvider>
        <EditarAnuncioRoute />
      </AuthProvider>
    );
    await waitFor(() => {
      expect(queryByTestId('access-loading')).toBeNull();
    });
    expect(queryByTestId('animal-form-screen')).toBeNull();
  });

  it('deve renderizar rota de login (mock)', async () => {
    const { getByTestId } = await render(
      <AuthProvider>
        <LoginRoute />
      </AuthProvider>
    );
    expect(getByTestId('login-screen')).toBeTruthy();
  });

  it('deve renderizar rota de cadastro (mock)', async () => {
    const { getByTestId } = await render(
      <AuthProvider>
        <CadastroRoute />
      </AuthProvider>
    );
    expect(getByTestId('register-screen')).toBeTruthy();
  });
});
