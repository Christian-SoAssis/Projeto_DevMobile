import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { LoginScreen } from '../../src/adapters/screens/LoginScreen';
import { RegisterScreen } from '../../src/adapters/screens/RegisterScreen';
import { AuthGatewayFake } from '../../src/application/fakes/AuthGatewayFake';
import { SessionStorageFake } from '../../src/application/fakes/SessionStorageFake';

describe('Auth stub screens (100% mock)', () => {
  describe('LoginScreen', () => {
    it('deve exigir e-mail e senha', async () => {
      const { getByTestId, getByText } = await render(
        <LoginScreen authGateway={new AuthGatewayFake()} sessionStorage={new SessionStorageFake()} />
      );
      await fireEvent.press(getByTestId('btn-login'));
      await waitFor(() => {
        expect(getByText('E-mail e senha são obrigatórios.')).toBeTruthy();
      });
    });

    it('deve rejeitar usuário inexistente', async () => {
      const { getByTestId, getByText } = await render(
        <LoginScreen authGateway={new AuthGatewayFake()} sessionStorage={new SessionStorageFake()} />
      );
      await fireEvent.changeText(getByTestId('input-email'), 'ninguem@exemplo.com');
      await fireEvent.changeText(getByTestId('input-pass'), 'qualquer');
      await fireEvent.press(getByTestId('btn-login'));
      await waitFor(() => {
        expect(getByText('Usuário não encontrado.')).toBeTruthy();
      });
    });

    it('deve autenticar com fake e persistir token no storage stub', async () => {
      const gateway = new AuthGatewayFake();
      const storage = new SessionStorageFake();
      const onSuccess = jest.fn();
      const { getByTestId, getByText } = await render(
        <LoginScreen authGateway={gateway} sessionStorage={storage} onSuccess={onSuccess} />
      );
      await fireEvent.changeText(getByTestId('input-email'), 'ana@exemplo.com');
      await fireEvent.changeText(getByTestId('input-pass'), 'password123');
      await fireEvent.press(getByTestId('btn-login'));
      await waitFor(() => {
        expect(getByText('Login realizado com sucesso!')).toBeTruthy();
      });
      expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: 'usr_1' }));
      expect(await storage.getSessionToken()).toBe('fake_token_usr_1');
    });
  });

  describe('RegisterScreen', () => {
    it('deve exigir nome', async () => {
      const { getByTestId, getByText } = await render(
        <RegisterScreen authGateway={new AuthGatewayFake()} />
      );
      await fireEvent.changeText(getByTestId('input-email'), 'novo@exemplo.com');
      await fireEvent.changeText(getByTestId('input-pass'), '123456');
      await fireEvent.press(getByTestId('btn-register'));
      await waitFor(() => {
        expect(getByText('Nome é obrigatório.')).toBeTruthy();
      });
    });

    it('deve rejeitar e-mail duplicado do fake', async () => {
      const { getByTestId, getByText } = await render(
        <RegisterScreen authGateway={new AuthGatewayFake()} />
      );
      await fireEvent.changeText(getByTestId('input-name'), 'Ana Silva');
      await fireEvent.changeText(getByTestId('input-email'), 'ana@exemplo.com');
      await fireEvent.changeText(getByTestId('input-pass'), '123456');
      await fireEvent.press(getByTestId('btn-register'));
      await waitFor(() => {
        expect(getByText('E-mail já cadastrado (mock).')).toBeTruthy();
      });
    });

    it('deve cadastrar novo usuário no fake', async () => {
      const gateway = new AuthGatewayFake();
      const onSuccess = jest.fn();
      const { getByTestId, getByText } = await render(
        <RegisterScreen authGateway={gateway} onSuccess={onSuccess} />
      );
      await fireEvent.changeText(getByTestId('input-name'), 'Maria Souza');
      await fireEvent.changeText(getByTestId('input-email'), 'maria@exemplo.com');
      await fireEvent.changeText(getByTestId('input-pass'), '123456');
      await fireEvent.press(getByTestId('btn-register'));
      await waitFor(() => {
        expect(getByText('Cadastro realizado com sucesso! Faça login.')).toBeTruthy();
      });
      expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ name: 'Maria Souza' }));
      expect(gateway.mockUsers.some((u) => u.contactInfo.email === 'maria@exemplo.com')).toBe(true);
    });
  });
});
