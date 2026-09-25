import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../../domain/entities/User';
import { AuthGateway, AuthSession } from '../../domain/ports/AuthGateway';
import { SessionStorage } from '../../domain/ports/SessionStorage';
import { AuthenticateUserUseCase } from '../../application/use-cases/AuthenticateUserUseCase';
import { AcessarViaTokenUseCase } from '../../application/use-cases/AcessarViaTokenUseCase';
import { AuthGatewayFake } from '../../application/fakes/AuthGatewayFake';
import { SessionStorageFake } from '../../application/fakes/SessionStorageFake';

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  acessarViaToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export interface AuthProviderProps {
  children: React.ReactNode;
  authGateway?: AuthGateway;
  sessionStorage?: SessionStorage;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  authGateway = new AuthGatewayFake(),
  sessionStorage = new SessionStorageFake(),
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const authenticateUseCase = new AuthenticateUserUseCase(authGateway, sessionStorage);
  const tokenUseCase = new AcessarViaTokenUseCase(authGateway, sessionStorage);

  useEffect(() => {
    async function loadSession() {
      try {
        const savedToken = await sessionStorage.getSessionToken();
        if (savedToken) {
          const session = await authGateway.acessarViaToken(savedToken);
          setUser(session.user);
          setToken(session.token);
        }
      } catch {
        await sessionStorage.clearSession();
      } finally {
        setIsLoading(false);
      }
    }
    loadSession();
  }, []);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const session = await authenticateUseCase.execute(email, pass);
      setUser(session.user);
      setToken(session.token);
    } finally {
      setIsLoading(false);
    }
  };

  const acessarViaToken = async (tok: string) => {
    setIsLoading(true);
    try {
      const session = await tokenUseCase.execute(tok);
      setUser(session.user);
      setToken(session.token);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await authGateway.logout();
    await sessionStorage.clearSession();
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        acessarViaToken,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
}
