import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../../domain/entities/User';
import { AuthGateway, AuthSession, RegisterInput, RegisterResult } from '../../domain/ports/AuthGateway';
import { UserRepository } from '../../domain/ports/UserRepository';
import { PhotoStorage } from '../../domain/ports/PhotoStorage';
import { ProfilePatch } from '../../domain/value-objects/UserProfile';
import { UpdateProfileUseCase, UpdateProfileResult } from '../../application/use-cases/UpdateProfileUseCase';
import { SessionStorage } from '../../domain/ports/SessionStorage';
import { AuthenticateUserUseCase } from '../../application/use-cases/AuthenticateUserUseCase';
import { AcessarViaTokenUseCase } from '../../application/use-cases/AcessarViaTokenUseCase';
import { AuthGatewayFake } from '../../application/fakes/AuthGatewayFake';
import { UserRepositoryFake } from '../../application/fakes/UserRepositoryFake';
import { SessionStorageFake } from '../../application/fakes/SessionStorageFake';
import { useRepositories } from './RepositoriesContext';
import { publishActiveUserId, resetActiveUserId } from '../sync/activeSession';

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Gateway/armazenamento ativos (Supabase quando configurado, fake no demo). */
  authGateway: AuthGateway;
  sessionStorage: SessionStorage;
  login: (email: string, pass: string) => Promise<User>;
  /** Cria a conta e, se o servidor não exigir confirmação de e-mail, já entra (`loggedIn`). */
  register: (input: RegisterInput) => Promise<RegisterResult & { loggedIn: boolean }>;
  updateProfile: (patch: ProfilePatch) => Promise<UpdateProfileResult>;
  acessarViaToken: (token: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export interface AuthProviderProps {
  children: React.ReactNode;
  authGateway?: AuthGateway;
  sessionStorage?: SessionStorage;
  /** Perfil local (SQLite): descrição, interesses e foto editados neste aparelho. */
  userRepository?: UserRepository;
  photoStorage?: PhotoStorage;
  /** Upload da foto de perfil ao Storage (só com backend configurado). */
  remotePhotoStorage?: PhotoStorage;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  authGateway = new AuthGatewayFake(),
  sessionStorage = new SessionStorageFake(),
  userRepository,
  photoStorage,
  remotePhotoStorage,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // DAT-10 (ordens 0/2): a sincronização só envia ações da conta logada.
  // Publicado no RENDER (não em efeito): efeitos dos filhos — o AutoSync —
  // rodam antes dos do pai, e um ciclo no boot veria "sessão desconhecida"
  // (sem filtro). `null` enquanto a sessão carrega: nenhuma ação com dono
  // sobe antes de se saber quem está logado. Escrita idempotente.
  publishActiveUserId(user?.id ?? null);
  useEffect(() => () => resetActiveUserId(), []);

  const authenticateUseCase = new AuthenticateUserUseCase(authGateway, sessionStorage);
  const tokenUseCase = new AcessarViaTokenUseCase(authGateway, sessionStorage);

  /**
   * O perfil editado neste aparelho vence o do servidor (evita perder uma
   * edição feita offline). Sem edição local, vale o perfil remoto.
   */
  async function hydrate(remote: User): Promise<User> {
    if (!userRepository) return remote;
    try {
      const local = await userRepository.findById(remote.id);
      if (!local) return remote;
      return remote.withProfile({
        name: local.name,
        phone: local.contactInfo.phone ?? remote.contactInfo.phone,
        bio: local.bio || remote.bio,
        interests: local.interests.length ? local.interests : remote.interests,
        avatarUri: local.avatarUri ?? remote.avatarUri,
      });
    } catch {
      return remote;
    }
  }

  useEffect(() => {
    async function loadSession() {
      try {
        const savedToken = await sessionStorage.getSessionToken();
        if (savedToken) {
          const session = await authGateway.acessarViaToken(savedToken);
          setUser(await hydrate(session.user));
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

  const login = async (email: string, pass: string): Promise<User> => {
    setIsLoading(true);
    try {
      const session = await authenticateUseCase.execute(email, pass);
      const hydrated = await hydrate(session.user);
      setUser(hydrated);
      setToken(session.token);
      return hydrated;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (input: RegisterInput) => {
    const result = await authGateway.register(input);
    if (result.needsEmailConfirmation) return { ...result, loggedIn: false };
    try {
      await login(input.email, input.password);
      return { ...result, loggedIn: true };
    } catch {
      // Conta criada, mas a entrada automática falhou: a pessoa entra pela tela de login.
      return { ...result, loggedIn: false };
    }
  };

  const updateProfile = async (patch: ProfilePatch): Promise<UpdateProfileResult> => {
    if (!user) throw new Error('Faça login para editar o perfil.');
    const useCase = new UpdateProfileUseCase(
      authGateway,
      userRepository ?? new UserRepositoryFake(),
      photoStorage,
      remotePhotoStorage
    );
    const result = await useCase.execute(user, patch);
    setUser(result.user);
    return result;
  };

  const acessarViaToken = async (tok: string) => {
    setIsLoading(true);
    try {
      const session = await tokenUseCase.execute(tok);
      setUser(await hydrate(session.user));
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
        authGateway,
        sessionStorage,
        login,
        register,
        updateProfile,
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

export interface AuthProviderBridgeProps {
  children: React.ReactNode;
  sessionStorage?: SessionStorage;
}

/**
 * Ponte entre composição e autenticação (Fase 3): consome o container
 * montado por `RepositoriesProvider` e entrega o `SupabaseAuthGateway`
 * quando o backend está configurado — sem ele, cai no fake default
 * (`AuthGatewayFake`), mantendo o app 100% utilizável offline.
 */
export function AuthProviderBridge({ children, sessionStorage }: AuthProviderBridgeProps) {
  const container = useRepositories();
  return (
    <AuthProvider
      authGateway={container.authGateway}
      sessionStorage={sessionStorage}
      userRepository={container.userRepository}
      photoStorage={container.photoStorage}
      remotePhotoStorage={container.remotePhotoStorage}
    >
      {children}
    </AuthProvider>
  );
}
