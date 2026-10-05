import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { LoginScreen } from '../../src/adapters/screens/LoginScreen';
import { RegisterScreen } from '../../src/adapters/screens/RegisterScreen';
import { AuthGatewayFake } from '../../src/application/fakes/AuthGatewayFake';
import { SessionStorageFake } from '../../src/application/fakes/SessionStorageFake';

describe('Auth stub screens (100% mock)', () => {
  describe('LoginScreen', () => {
    it('deve exigir e-mail e senha', async () => {
      const { getByTestId, getByText } = render(
        <LoginScreen authGateway={new AuthGatewayFake()} sessionStorage={new SessionStorageFake()} />
      );
      fireEvent.press(getByTestId('btn-login'));
      await waitFor(() => {
        expect(getByText('E-mail e senha são obrigatórios.')).toBeTruthy();
      });
    });

    it('deve rejeitar usuário inexistente', async () => {
      const { getByTestId, getByText } = render(
        <LoginScreen authGateway={new AuthGatewayFake()} sessionStorage={new SessionStorageFake()} />
      );
      fireEvent.changeText(getByTestId('input-email'), 'ninguem@exemplo.com');
      fireEvent.changeText(getByTestId('input-pass'), 'qualquer');
      fireEvent.press(getByTestId('btn-login'));
      await waitFor(() => {
        expect(getByText('Usuário não encontrado.')).toBeTruthy();
      });
    });

    it('deve autenticar com fake e persistir token no storage stub', async () => {
      const gateway = new AuthGatewayFake();
      const storage = new SessionStorageFake();
      const onSuccess = jest.fn();
      const { getByTestId, getByText } = render(
        <LoginScreen authGateway={gateway} sessionStorage={storage} onSuccess={onSuccess} />
      );
      fireEvent.changeText(getByTestId('input-email'), 'ana@exemplo.com');
      fireEvent.changeText(getByTestId('input-pass'), 'password123');
      fireEvent.press(getByTestId('btn-login'));
      await waitFor(() => {
        expect(getByText('Login realizado com sucesso!')).toBeTruthy();
      });
      expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: 'usr_1' }));
      expect(await storage.getSessionToken()).toBe('fake_token_usr_1');
    });
  });

  describe('RegisterScreen', () => {
    it('deve exigir nome', async () => {
      const { getByTestId, getByText } = render(
        <RegisterScreen authGateway={new AuthGatewayFake()} />
      );
      fireEvent.changeText(getByTestId('input-email'), 'novo@exemplo.com');
      fireEvent.changeText(getByTestId('input-pass'), '123456');
      fireEvent.press(getByTestId('btn-register'));
      await waitFor(() => {
        expect(getByText('Nome é obrigatório.')).toBeTruthy();
      });
    });

    it('deve rejeitar e-mail duplicado do fake', async () => {
      const { getByTestId, getByText } = render(
        <RegisterScreen authGateway={new AuthGatewayFake()} />
      );
      fireEvent.changeText(getByTestId('input-name'), 'Ana Silva');
      fireEvent.changeText(getByTestId('input-email'), 'ana@exemplo.com');
      fireEvent.changeText(getByTestId('input-pass'), '123456');
      fireEvent.press(getByTestId('btn-register'));
      await waitFor(() => {
        expect(getByText('E-mail já cadastrado (mock).')).toBeTruthy();
      });
    });

    it('deve cadastrar novo usuário no fake', async () => {
      const gateway = new AuthGatewayFake();
      const onSuccess = jest.fn();
      const { getByTestId, getByText } = render(
        <RegisterScreen authGateway={gateway} onSuccess={onSuccess} />
      );
      fireEvent.changeText(getByTestId('input-name'), 'Maria Souza');
      fireEvent.changeText(getByTestId('input-email'), 'maria@exemplo.com');
      fireEvent.changeText(getByTestId('input-pass'), '123456');
      fireEvent.press(getByTestId('btn-register'));
      await waitFor(() => {
        expect(getByText('Cadastro realizado com sucesso! Faça login.')).toBeTruthy();
      });
      expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ name: 'Maria Souza' }));
      expect(gateway.mockUsers.some((u) => u.contactInfo.email === 'maria@exemplo.com')).toBe(true);
    });
  });
});
