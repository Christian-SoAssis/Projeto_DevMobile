import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AccountScreen } from '../../src/adapters/screens/AccountScreen';
import { RegisterScreen } from '../../src/adapters/screens/RegisterScreen';
import { AuthProvider, useAuth } from '../../src/adapters/context/AuthContext';
import { AuthGatewayFake } from '../../src/application/fakes/AuthGatewayFake';
import { SessionStorageFake } from '../../src/application/fakes/SessionStorageFake';
import { UserRepositoryFake } from '../../src/application/fakes/UserRepositoryFake';
import { CameraGatewayFake } from '../../src/application/fakes/CameraGatewayFake';
import { CameraGateway } from '../../src/domain/ports/CameraGateway';

const ana = () => new AuthGatewayFake().mockUsers[0];

describe('AccountScreen — edição de perfil', () => {
  it('edita nome, telefone, descrição e interesses e envia ao salvar', async () => {
    const user = ana();
    const onSaveProfile = jest.fn().mockResolvedValue({ user, syncedRemotely: true });
    const { getByTestId, getByText } = await render(
      <AccountScreen user={user} onSaveProfile={onSaveProfile} />
    );

    await fireEvent.changeText(getByTestId('profile-name'), 'Ana Maria');
    await fireEvent.changeText(getByTestId('profile-phone'), '11888887777');
    await fireEvent.changeText(getByTestId('profile-bio'), 'Tenho dois gatos');
    expect(getByTestId('profile-bio-counter').props.children.join('')).toBe('16/300');
    await fireEvent.press(getByTestId('interest-Gatos'));
    await fireEvent.press(getByTestId('interest-Cães'));
    await fireEvent.press(getByTestId('interest-Cães')); // desmarca
    await fireEvent.press(getByTestId('profile-save'));

    await waitFor(() => expect(getByText('Perfil atualizado!')).toBeTruthy());
    expect(onSaveProfile).toHaveBeenCalledWith({
      name: 'Ana Maria',
      phone: '11888887777',
      bio: 'Tenho dois gatos',
      interests: ['Gatos'],
      avatarUri: null,
    });
  });

  it('avisa quando o perfil ficou só no aparelho e quando o salvamento falha', async () => {
    const user = ana();
    const onSaveProfile = jest
      .fn()
      .mockResolvedValueOnce({ user, syncedRemotely: false })
      .mockRejectedValueOnce(new Error('Nome do usuário é obrigatório.'));
    const { getByTestId, getByText } = await render(
      <AccountScreen user={user} onSaveProfile={onSaveProfile} />
    );
    await fireEvent.press(getByTestId('profile-save'));
    await waitFor(() =>
      expect(getByText('Perfil salvo neste aparelho. Não foi possível enviar ao servidor agora.')).toBeTruthy()
    );
    await fireEvent.press(getByTestId('profile-save'));
    await waitFor(() => expect(getByText('Nome do usuário é obrigatório.')).toBeTruthy());
  });

  it('foto de perfil: galeria, câmera negada e remover', async () => {
    const user = ana();
    const camera: CameraGateway = {
      capturePhoto: jest.fn().mockResolvedValue(null),
      pickImageFromGallery: jest.fn().mockResolvedValue({ uri: 'file://g.jpg' }),
    };
    const onSaveProfile = jest.fn().mockResolvedValue({ user, syncedRemotely: true });
    const { getByTestId, getByText, queryByTestId } = await render(
      <AccountScreen user={user} cameraGateway={camera} onSaveProfile={onSaveProfile} />
    );

    await fireEvent.press(getByTestId('avatar-camera'));
    await waitFor(() =>
      expect(getByText('Não foi possível usar a câmera. Escolha uma foto da galeria.')).toBeTruthy()
    );

    await fireEvent.press(getByTestId('avatar-gallery'));
    await waitFor(() => expect(getByTestId('avatar-remove')).toBeTruthy());
    await fireEvent.press(getByTestId('profile-save'));
    await waitFor(() =>
      expect(onSaveProfile).toHaveBeenCalledWith(expect.objectContaining({ avatarUri: 'file://g.jpg' }))
    );

    await fireEvent.press(getByTestId('avatar-remove'));
    expect(queryByTestId('avatar-remove')).toBeNull();
  });

  it('erro ao acessar a foto vira mensagem, não exceção', async () => {
    const camera: CameraGateway = {
      capturePhoto: jest.fn(),
      pickImageFromGallery: jest.fn().mockRejectedValue(new Error('boom')),
    };
    const { getByTestId, getByText } = await render(<AccountScreen user={ana()} cameraGateway={camera} />);
    await fireEvent.press(getByTestId('avatar-gallery'));
    await waitFor(() => expect(getByText('Não foi possível acessar a foto. Tente novamente.')).toBeTruthy());
  });

  it('mostra a foto salva no cabeçalho', async () => {
    const withPhoto = ana().withProfile({ avatarUri: 'file://a.jpg' });
    const { getAllByTestId } = await render(
      <AccountScreen user={withPhoto} cameraGateway={new CameraGatewayFake()} />
    );
    expect(getAllByTestId('account-avatar-image').length).toBeGreaterThan(0);
  });

  it('sem foto, mostra a inicial do nome', async () => {
    const { getAllByTestId } = await render(<AccountScreen user={ana()} />);
    expect(getAllByTestId('account-avatar-placeholder').length).toBeGreaterThan(0);
  });
});

describe('Cadastro com entrada automática (AuthContext.register)', () => {
  function Harness({ onDone }: { onDone: (s: { userName?: string }) => void }) {
    const auth = useAuth();
    React.useEffect(() => {
      onDone({ userName: auth.user?.name });
    }, [auth.user]);
    return <RegisterScreen onRegister={auth.register} />;
  }

  async function fillAndSubmit(utils: Awaited<ReturnType<typeof render>>) {
    await fireEvent.changeText(utils.getByTestId('input-name'), 'Maria Souza');
    await fireEvent.changeText(utils.getByTestId('input-email'), 'maria@exemplo.com');
    await fireEvent.changeText(utils.getByTestId('input-pass'), '123456');
    await fireEvent.changeText(utils.getByTestId('input-confirm-pass'), '123456');
    await fireEvent.press(utils.getByTestId('btn-register'));
  }

  it('sem confirmação de e-mail: cria, entra sozinha e guarda a sessão', async () => {
    const gateway = new AuthGatewayFake();
    const storage = new SessionStorageFake();
    const seen: Array<string | undefined> = [];
    const utils = await render(
      <AuthProvider authGateway={gateway} sessionStorage={storage}>
        <Harness onDone={(s) => seen.push(s.userName)} />
      </AuthProvider>
    );
    await fillAndSubmit(utils);
    await waitFor(() => expect(utils.getByText('Conta criada! Você já está conectado.')).toBeTruthy());
    expect(seen).toContain('Maria Souza');
    expect(await storage.getSessionToken()).toMatch(/^fake_token_usr_/);
  });

  it('com confirmação de e-mail: não entra e orienta a confirmar', async () => {
    const gateway = new AuthGatewayFake();
    const original = gateway.register.bind(gateway);
    gateway.register = async (input) => ({ ...(await original(input)), needsEmailConfirmation: true });
    const storage = new SessionStorageFake();
    const utils = await render(
      <AuthProvider authGateway={gateway} sessionStorage={storage}>
        <Harness onDone={() => {}} />
      </AuthProvider>
    );
    await fillAndSubmit(utils);
    await waitFor(() =>
      expect(utils.getByText('Cadastro realizado! Confirme seu e-mail e depois faça login.')).toBeTruthy()
    );
    expect(await storage.getSessionToken()).toBeNull();
  });

  it('se a entrada automática falhar, a conta existe e a pessoa é mandada ao login', async () => {
    const gateway = new AuthGatewayFake();
    gateway.login = jest.fn().mockRejectedValue(new Error('falhou'));
    const utils = await render(
      <AuthProvider authGateway={gateway} sessionStorage={new SessionStorageFake()}>
        <Harness onDone={() => {}} />
      </AuthProvider>
    );
    await fillAndSubmit(utils);
    await waitFor(() => expect(utils.getByText('Cadastro realizado com sucesso! Faça login.')).toBeTruthy());
  });
});

describe('AuthContext.updateProfile / perfil local', () => {
  function Probe({ capture }: { capture: (a: ReturnType<typeof useAuth>) => void }) {
    capture(useAuth());
    return <Text>ok</Text>;
  }

  it('exige login para editar', async () => {
    let auth!: ReturnType<typeof useAuth>;
    await render(
      <AuthProvider authGateway={new AuthGatewayFake()} sessionStorage={new SessionStorageFake()}>
        <Probe capture={(a) => (auth = a)} />
      </AuthProvider>
    );
    await expect(auth.updateProfile({ bio: 'x' })).rejects.toThrow('Faça login para editar o perfil.');
  });

  it('edição local vence o servidor ao reentrar (não perde edição feita offline)', async () => {
    const gateway = new AuthGatewayFake();
    const repo = new UserRepositoryFake();
    const storage = new SessionStorageFake();
    await repo.save(gateway.mockUsers[0].withProfile({ bio: 'bio local', interests: ['Gatos'] }));

    let auth!: ReturnType<typeof useAuth>;
    await render(
      <AuthProvider authGateway={gateway} sessionStorage={storage} userRepository={repo}>
        <Probe capture={(a) => (auth = a)} />
      </AuthProvider>
    );
    await waitFor(() => expect(auth.isLoading).toBe(false));
    const user = await auth.login('ana@exemplo.com', 'senha');
    expect(user.bio).toBe('bio local');
    expect(user.interests).toEqual(['Gatos']);

    // `auth` é reatribuído a cada render: espera o estado com o usuário logado.
    await waitFor(() => expect(auth.user?.id).toBe('usr_1'));
    const saved = await auth.updateProfile({ bio: 'novo' });
    expect(saved.user.bio).toBe('novo');
    expect((await repo.findById('usr_1'))?.bio).toBe('novo');
  });
});
