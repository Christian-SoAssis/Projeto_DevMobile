import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import CadastroScreen from '../../../app/(public)/cadastro';
import { mockAuth } from '../mocks/AuthContext.mock';
import { mockRouter } from '../mocks/expo-router.mock';

describe('CadastroScreen (RNTL)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve renderizar os elementos da tela de cadastro', async () => {
    const { getByText, getByPlaceholderText } = await render(<CadastroScreen />);

    expect(getByText('Uma nova história começa aqui.')).toBeTruthy();
    expect(getByPlaceholderText('Seu nome')).toBeTruthy();
    expect(getByPlaceholderText('Seu e-mail')).toBeTruthy();
    expect(getByPlaceholderText('(35) 9 9999-9999')).toBeTruthy();
    expect(getByPlaceholderText('Sua senha (mín. 6 caracteres)')).toBeTruthy();
    expect(getByPlaceholderText('Confirme sua senha')).toBeTruthy();
    expect(getByText('Criar conta')).toBeTruthy();
    expect(getByText('Entrar')).toBeTruthy();
  });

  it('deve exibir mensagem de erro se o nome estiver vazio', async () => {
    const { getByText, findByText } = await render(<CadastroScreen />);

    await fireEvent.press(getByText('Criar conta'));

    expect(await findByText('Informe seu nome completo.')).toBeTruthy();
    expect(mockAuth.register).not.toHaveBeenCalled();
  });

  it('deve exibir mensagem de erro se o e-mail for omitido', async () => {
    const { getByText, getByPlaceholderText, findByText } = await render(<CadastroScreen />);

    await fireEvent.changeText(getByPlaceholderText('Seu nome'), 'Carla Mendes');
    await fireEvent.press(getByText('Criar conta'));

    expect(await findByText('Informe um e-mail válido.')).toBeTruthy();
    expect(mockAuth.register).not.toHaveBeenCalled();
  });

  it('deve exibir erro se a senha tiver menos de 6 caracteres', async () => {
    const { getByText, getByPlaceholderText, findByText } = await render(<CadastroScreen />);

    await fireEvent.changeText(getByPlaceholderText('Seu nome'), 'Carla Mendes');
    await fireEvent.changeText(getByPlaceholderText('Seu e-mail'), 'carla@enlace.org');
    await fireEvent.changeText(getByPlaceholderText('Sua senha (mín. 6 caracteres)'), '12345');
    await fireEvent.changeText(getByPlaceholderText('Confirme sua senha'), '12345');

    await fireEvent.press(getByText('Criar conta'));

    expect(await findByText('A senha precisa ter no mínimo 6 caracteres.')).toBeTruthy();
    expect(mockAuth.register).not.toHaveBeenCalled();
  });

  it('deve exibir erro se a confirmação de senha divergir', async () => {
    const { getByText, getByPlaceholderText, findByText } = await render(<CadastroScreen />);

    await fireEvent.changeText(getByPlaceholderText('Seu nome'), 'Carla Mendes');
    await fireEvent.changeText(getByPlaceholderText('Seu e-mail'), 'carla@enlace.org');
    await fireEvent.changeText(getByPlaceholderText('Sua senha (mín. 6 caracteres)'), 'senha123');
    await fireEvent.changeText(getByPlaceholderText('Confirme sua senha'), 'outrasenha');

    await fireEvent.press(getByText('Criar conta'));

    expect(await findByText('As senhas digitadas não conferem.')).toBeTruthy();
    expect(mockAuth.register).not.toHaveBeenCalled();
  });

  it('deve submeter o cadastro com sucesso e redirecionar para a área principal', async () => {
    mockAuth.register.mockResolvedValueOnce(undefined);

    const { getByText, getByPlaceholderText } = await render(<CadastroScreen />);

    await fireEvent.changeText(getByPlaceholderText('Seu nome'), 'Carla Mendes');
    await fireEvent.changeText(getByPlaceholderText('Seu e-mail'), 'carla@enlace.org');
    await fireEvent.changeText(getByPlaceholderText('(35) 9 9999-9999'), '35988887777');
    await fireEvent.changeText(getByPlaceholderText('Sua senha (mín. 6 caracteres)'), 'senha123');
    await fireEvent.changeText(getByPlaceholderText('Confirme sua senha'), 'senha123');

    await fireEvent.press(getByText('Criar conta'));

    await waitFor(() => {
      expect(mockAuth.register).toHaveBeenCalledWith({
        name: 'Carla Mendes',
        email: 'carla@enlace.org',
        password: 'senha123',
        contactInfo: '35988887777',
      });
      expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
    });
  });

  it('deve exibir erro retornado pelo gateway de autenticação', async () => {
    mockAuth.register.mockRejectedValueOnce(new Error('E-mail já cadastrado'));

    const { getByText, getByPlaceholderText, findByText } = await render(<CadastroScreen />);

    await fireEvent.changeText(getByPlaceholderText('Seu nome'), 'Carla Mendes');
    await fireEvent.changeText(getByPlaceholderText('Seu e-mail'), 'repetido@enlace.org');
    await fireEvent.changeText(getByPlaceholderText('Sua senha (mín. 6 caracteres)'), 'senha123');
    await fireEvent.changeText(getByPlaceholderText('Confirme sua senha'), 'senha123');

    await fireEvent.press(getByText('Criar conta'));

    expect(await findByText('E-mail já cadastrado')).toBeTruthy();
  });

  it('deve navegar de volta para o login ao tocar no link correspondente', async () => {
    const { getByText } = await render(<CadastroScreen />);

    await fireEvent.press(getByText('Entrar'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/(public)/login');
  });
});
