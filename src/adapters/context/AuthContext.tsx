import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { User } from '../../domain/entities/User';
import { RegisterInput, UpdateProfileInput } from '../../domain/ports/AuthGateway';
import { useRepositories } from './RepositoriesContext';
import { setActiveUserId } from '../sync/activeSession';
import { generateUuid } from '../../domain/services/IdGenerator';

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login(email: string, password: string): Promise<User>;
  register(input: RegisterInput): Promise<User>;
  updateProfile(input: Omit<UpdateProfileInput, 'userId'>): Promise<User>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const container = useRepositories();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const hydrateUserRemoteData = useCallback(
    async (loggedUser: User) => {
      try {
        if (container.remoteFavorites) {
          const remoteFavs = await container.remoteFavorites.listByUser(loggedUser.id);
          for (const fav of remoteFavs) {
            await container.favoriteRepository.add(fav);
          }
        }
        if (container.remoteInterests) {
          const remoteInts = await container.remoteInterests.listByUser(loggedUser.id);
          for (const interest of remoteInts) {
            await container.interestRepository.save(interest);
          }
        }
      } catch {
        // Sem internet na restauração: mantém cache local
      }
    },
    [container]
  );

  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        if (container.authGateway) {
          const session = await container.authGateway.restoreSession();
          if (session?.user && active) {
            await container.userRepository.saveCurrentUser(session.user);
            setActiveUserId(session.user.id);
            setUser(session.user);
            await hydrateUserRemoteData(session.user);
            return;
          }
        }
        const cachedUser = await container.userRepository.getCurrentUser();
        if (cachedUser && active && !container.authGateway) {
          setActiveUserId(cachedUser.id);
          setUser(cachedUser);
        } else if (active) {
          await container.userRepository.clearCurrentUser();
          setActiveUserId(null);
          setUser(null);
        }
      } catch {
        if (active) {
          setActiveUserId(null);
          setUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    restore();
    return () => {
      active = false;
    };
  }, [container, hydrateUserRemoteData]);

  const login = useCallback(
    async (email: string, password: string): Promise<User> => {
      if (container.authGateway) {
        const session = await container.authGateway.login(email, password);
        await container.userRepository.saveCurrentUser(session.user);
        setActiveUserId(session.user.id);
        setUser(session.user);
        await hydrateUserRemoteData(session.user);
        return session.user;
      }

      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail || !password) {
        throw new Error('Informe e-mail e senha.');
      }
      const localUser = new User({
        id: generateUuid(),
        name: cleanEmail.split('@')[0],
        email: cleanEmail,
        role: cleanEmail.includes('admin') ? 'ADMIN' : 'USER',
      });
      await container.userRepository.saveCurrentUser(localUser);
      setActiveUserId(localUser.id);
      setUser(localUser);
      return localUser;
    },
    [container, hydrateUserRemoteData]
  );

  const register = useCallback(
    async (input: RegisterInput): Promise<User> => {
      if (container.authGateway) {
        const session = await container.authGateway.register(input);
        await container.userRepository.saveCurrentUser(session.user);
        setActiveUserId(session.user.id);
        setUser(session.user);
        return session.user;
      }

      const localUser = new User({
        id: generateUuid(),
        name: input.name,
        email: input.email,
        contactInfo: input.contactInfo,
        role: 'USER',
      });
      await container.userRepository.saveCurrentUser(localUser);
      setActiveUserId(localUser.id);
      setUser(localUser);
      return localUser;
    },
    [container]
  );

  const updateProfile = useCallback(
    async (input: Omit<UpdateProfileInput, 'userId'>): Promise<User> => {
      if (!user) throw new Error('Faça login para editar seu perfil.');

      if (container.authGateway) {
        const updated = await container.authGateway.updateProfile({
          ...input,
          userId: user.id,
        });
        await container.userRepository.saveCurrentUser(updated);
        setUser(updated);
        return updated;
      }

      const updated = new User({
        id: user.id,
        name: input.name,
        email: user.email,
        contactInfo: input.contactInfo,
        bio: input.bio,
        avatarUrl: input.avatarUrl ?? user.avatarUrl,
        interestsTags: input.interestsTags ?? user.interestsTags,
        role: user.role,
      });
      await container.userRepository.saveCurrentUser(updated);
      setUser(updated);
      return updated;
    },
    [container, user]
  );

  const logout = useCallback(async () => {
    if (container.authGateway) {
      try {
        await container.authGateway.logout();
      } catch {
        // ignora erro de rede no logout
      }
    }
    await container.userRepository.clearCurrentUser();
    setActiveUserId(null);
    setUser(null);
  }, [container]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, updateProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider.');
  }
  return ctx;
}
