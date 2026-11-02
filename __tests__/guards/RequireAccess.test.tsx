import React from 'react';
import { Text } from 'react-native';
import { render, waitFor, fireEvent } from '@testing-library/react-native';

const mockReplace = jest.fn();
jest.mock('expo-router', () => {
  const { Text: T } = require('react-native');
  return {
    useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
    Redirect: ({ href }: { href: string }) => <T testID="redirect">{href}</T>,
  };
});

import { AuthProvider } from '../../src/adapters/context/AuthContext';
import { RequireAccess } from '../../src/adapters/guards/RequireAccess';
import { AccountScreen } from '../../src/adapters/screens/AccountScreen';
import { AuthGatewayFake } from '../../src/application/fakes/AuthGatewayFake';
import { SessionStorageFake } from '../../src/application/fakes/SessionStorageFake';

// O fake restaura mockUsers[0] (Ana, RESPONSIBLE) para qualquer token salvo.
async function withSession(kind: 'ana' | 'admin' | 'visitor') {
  const gateway = new AuthGatewayFake();
  const storage = new SessionStorageFake();
  if (kind === 'ana') await storage.saveSessionToken('t');
  if (kind === 'admin') {
    await storage.saveSessionToken('t');
    gateway.mockUsers = [gateway.mockUsers[2]];
  }
  return { gateway, storage };
}

describe('RequireAccess (guarda de rotas)', () => {
  beforeEach(() => mockReplace.mockClear());

  it('visitante em área restrita → redireciona para /login', async () => {
    const { gateway, storage } = await withSession('visitor');
    const { getByTestId, queryByText } = await render(
      <AuthProvider authGateway={gateway} sessionStorage={storage}>
        <RequireAccess area="FAVORITES">{() => <Text>segredo</Text>}</RequireAccess>
      </AuthProvider>
    );
    await waitFor(() => expect(getByTestId('redirect').props.children).toBe('/login'));
    expect(queryByText('segredo')).toBeNull();
  });

  it('autenticado acessa área autenticada e recebe o usuário', async () => {
    const { gateway, storage } = await withSession('ana');
    const { findByText } = await render(
      <AuthProvider authGateway={gateway} sessionStorage={storage}>
        <RequireAccess area="MY_ANIMALS">{(u) => <Text>olá {u.name}</Text>}</RequireAccess>
      </AuthProvider>
    );
    expect(await findByText('olá Ana Silva')).toBeTruthy();
  });

  it('usuário comum não entra na moderação (acesso negado); admin entra', async () => {
    const ana = await withSession('ana');
    const denied = await render(
      <AuthProvider authGateway={ana.gateway} sessionStorage={ana.storage}>
        <RequireAccess area="MODERATION">{() => <Text>painel</Text>}</RequireAccess>
      </AuthProvider>
    );
    expect(await denied.findByTestId('access-denied')).toBeTruthy();
    await fireEvent.press(denied.getByTestId('access-denied-back'));
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
    denied.unmount();

    const adm = await withSession('admin');
    const allowed = await render(
      <AuthProvider authGateway={adm.gateway} sessionStorage={adm.storage}>
        <RequireAccess area="MODERATION">{() => <Text>painel</Text>}</RequireAccess>
      </AuthProvider>
    );
    expect(await allowed.findByText('painel')).toBeTruthy();
  });
});

describe('AccountScreen', () => {
  it('visitante vê convite para entrar/criar conta', async () => {
    const onLogin = jest.fn();
    const onRegister = jest.fn();
    const { getByTestId } = await render(
      <AccountScreen user={null} onLogin={onLogin} onRegister={onRegister} />
    );
    await fireEvent.press(getByTestId('account-login'));
    await fireEvent.press(getByTestId('account-register'));
    expect(onLogin).toHaveBeenCalled();
    expect(onRegister).toHaveBeenCalled();
  });

  it('autenticado vê perfil, papel e consegue sair; carregando mostra spinner', async () => {
    const gateway = new AuthGatewayFake();
    const onLogout = jest.fn();
    const { getByTestId } = await render(<AccountScreen user={gateway.mockUsers[0]} onLogout={onLogout} />);
    expect(getByTestId('account-name').props.children).toBe('Ana Silva');
    expect(getByTestId('account-role').props.children).toBe('Responsável');
    await fireEvent.press(getByTestId('account-logout'));
    expect(onLogout).toHaveBeenCalled();

    const loading = await render(<AccountScreen user={null} isLoading />);
    expect(loading.getByTestId('account-loading')).toBeTruthy();
  });
});
