import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '../../../app/(public)/login';
import { mockAuth } from '../mocks/AuthContext.mock';
import { mockRouter } from '../mocks/expo-router.mock';

describe('LoginScreen (RNTL)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve renderizar os elementos da tela de login', async () => {
    const { getByText, getByPlaceholderText } = await render(<LoginScreen />);

    expect(getByText('Que bom te ver!')).toBeTruthy();
    expect(getByText('Mais conexões para novas histórias.')).toBeTruthy();
    expect(getByPlaceholderText('Seu e-mail')).toBeTruthy();
    expect(getByPlaceholderText('Sua senha')).toBeTruthy();
    expect(getByText('Entrar')).toBeTruthy();
    expect(getByText('Criar conta')).toBeTruthy();
  });

  it('deve exibir mensagem de erro ao submeter com campos vazios', async () => {
    const { getByText, findByText } = await render(<LoginScreen />);

    const submitBtn = getByText('Entrar');
    await fireEvent.press(submitBtn);

    expect(await findByText('Preencha seu e-mail e sua senha para entrar.')).toBeTruthy();
    expect(mockAuth.login).not.toHaveBeenCalled();
  });

  it('deve preencher e-mail e senha e realizar login com sucesso', async () => {
    mockAuth.login.mockResolvedValueOnce(undefined);

    const { getByText, getByPlaceholderText } = await render(<LoginScreen />);

    await fireEvent.changeText(getByPlaceholderText('Seu e-mail'), 'adotante@enlace.org');
    await fireEvent.changeText(getByPlaceholderText('Sua senha'), 'senha123');

    await fireEvent.press(getByText('Entrar'));

    await waitFor(() => {
      expect(mockAuth.login).toHaveBeenCalledWith('adotante@enlace.org', 'senha123');
      expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
    });
  });

  it('deve exibir mensagem de erro amigável se o login falhar', async () => {
    mockAuth.login.mockRejectedValueOnce(new Error('Credenciais inválidas'));

    const { getByText, getByPlaceholderText, findByText } = await render(<LoginScreen />);

    await fireEvent.changeText(getByPlaceholderText('Seu e-mail'), 'errado@enlace.org');
    await fireEvent.changeText(getByPlaceholderText('Sua senha'), 'senhaerrada');

    await fireEvent.press(getByText('Entrar'));

    expect(await findByText('Credenciais inválidas')).toBeTruthy();
  });

  it('deve navegar para a tela de cadastro ao tocar no botão correspondente', async () => {
    const { getByText } = await render(<LoginScreen />);

    await fireEvent.press(getByText('Criar conta'));
    expect(mockRouter.push).toHaveBeenCalledWith('/(public)/cadastro');
  });
});
