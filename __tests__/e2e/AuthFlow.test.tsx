import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AuthProvider } from '../../src/adapters/context/AuthContext';
import { SessionStorageFake } from '../../src/application/fakes/SessionStorageFake';
import { authGateway } from '../../src/adapters/demo/sharedFakes';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => {
  const ReactActual = jest.requireActual('react');
  const { Text: RNText } = jest.requireActual('react-native');
  return {
    useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack, canGoBack: () => true }),
    useLocalSearchParams: () => ({ id: 'anim_3' }),
    useFocusEffect: (cb: () => void) => ReactActual.useEffect(cb, [cb]),
    Redirect: ({ href }: { href: string }) => <RNText testID="redirect">{href}</RNText>,
    Stack: () => <RNText testID="stack">stack</RNText>,
  };
});

import LoginRoute from '../../app/login';
import CadastroRoute from '../../app/cadastro';
import HomeTab from '../../app/(tabs)/index';
import FavoritesTab from '../../app/(tabs)/favoritos';
import MeusAnunciosTab from '../../app/(tabs)/meus-anuncios';
import ProtectedLayout from '../../app/(protected)/_layout';
import AnimalDetailsRoute from '../../app/animal/[id]';

function renderWithAuth(ui: React.ReactElement) {
  return render(
    <AuthProvider authGateway={authGateway} sessionStorage={new SessionStorageFake()}>
      {ui}
    </AuthProvider>
  );
}

async function loginAs(getByTestId: ReturnType<typeof render>['getByTestId'], email: string, pass = '123') {
  fireEvent.press(getByTestId('account-login'));
  fireEvent.changeText(getByTestId('input-email'), email);
  fireEvent.changeText(getByTestId('input-pass'), pass);
  fireEvent.press(getByTestId('btn-login'));
}

describe('Fluxo de autenticação nas rotas', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
    mockBack.mockClear();
  });

  it('visitante vê convite de login em Favoritos e Meus anúncios', async () => {
    const fav = renderWithAuth(<FavoritesTab />);
    await waitFor(() => expect(fav.getByTestId('login-required')).toBeTruthy());
    fireEvent.press(fav.getByTestId('login-required-login'));
    expect(mockPush).toHaveBeenCalledWith('/login');

    const mine = renderWithAuth(<MeusAnunciosTab />);
    await waitFor(() => expect(mine.getByTestId('login-required')).toBeTruthy());
    fireEvent.press(mine.getByTestId('login-required-register'));
    expect(mockPush).toHaveBeenCalledWith('/cadastro');
  });

  it('rotas protegidas redirecionam visitante para o login', async () => {
    const { getByTestId } = renderWithAuth(<ProtectedLayout />);
    await waitFor(() => expect(getByTestId('redirect').props.children).toBe('/login'));
  });

  it('visitante precisa de login para favoritar nos detalhes', async () => {
    const { getByTestId, getByText } = renderWithAuth(<AnimalDetailsRoute />);
    await waitFor(() => expect(getByTestId('animal-details-screen')).toBeTruthy());
    fireEvent.press(getByTestId('favorite-button'));
    await waitFor(() => expect(getByText('Faça login para favoritar.')).toBeTruthy());
  });

  it('login atualiza o AuthContext e libera os anúncios do usuário', async () => {
    const LoggedApp = () => {
      const [screen, setScreen] = React.useState<'home' | 'login'>('home');
      mockPush.mockImplementation((href: string) => href === '/login' && setScreen('login'));
      mockBack.mockImplementation(() => setScreen('home'));
      return screen === 'login' ? (
        <LoginRoute />
      ) : (
        <>
          <HomeTab />
          <MeusAnunciosTab />
          <ProtectedLayout />
        </>
      );
    };
    const { getByTestId, getByText, queryByTestId } = renderWithAuth(<LoggedApp />);
    await waitFor(() => expect(getByTestId('account-login')).toBeTruthy());

    await loginAs(getByTestId, 'ana@exemplo.com');

    await waitFor(() => expect(getByText('Olá, Ana Silva')).toBeTruthy());
    await waitFor(() => expect(getByTestId('my-animals-title')).toBeTruthy());
    expect(getByText('Meus Anúncios (3)')).toBeTruthy();
    expect(getByTestId('stack')).toBeTruthy();
    expect(queryByTestId('redirect')).toBeNull();

    fireEvent.press(getByTestId('account-logout'));
    await waitFor(() => expect(getByTestId('login-required')).toBeTruthy());
    mockPush.mockReset();
    mockBack.mockReset();
  });

  it('usuário cadastrado consegue entrar com a senha cadastrada', async () => {
    const cadastro = renderWithAuth(<CadastroRoute />);
    await waitFor(() => expect(cadastro.getByTestId('register-screen')).toBeTruthy());
    fireEvent.changeText(cadastro.getByTestId('input-name'), 'Joana Lima');
    fireEvent.changeText(cadastro.getByTestId('input-email'), 'joana@exemplo.com');
    fireEvent.changeText(cadastro.getByTestId('input-pass'), 'minhasenha');
    fireEvent.press(cadastro.getByTestId('btn-register'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));

    const login = renderWithAuth(<LoginRoute />);
    fireEvent.changeText(login.getByTestId('input-email'), 'joana@exemplo.com');
    fireEvent.changeText(login.getByTestId('input-pass'), 'errada');
    fireEvent.press(login.getByTestId('btn-login'));
    await waitFor(() => expect(login.getByText('Credenciais inválidas.')).toBeTruthy());

    fireEvent.changeText(login.getByTestId('input-pass'), 'minhasenha');
    fireEvent.press(login.getByTestId('btn-login'));
    await waitFor(() => expect(login.getByText('Login realizado com sucesso!')).toBeTruthy());
    expect(mockBack).toHaveBeenCalled();
  });
});
