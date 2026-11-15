import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  AppContainer,
  loadAppContainer,
} from '../../infrastructure/composition/loadAppContainer';
import { InMemorySqliteDriver } from '../../infrastructure/database/sqlite/DatabaseDriver';

const RepositoriesContext = createContext<AppContainer | null>(null);

export interface RepositoriesProviderProps {
  children: React.ReactNode;
  container?: AppContainer;
}

export function RepositoriesProvider({ children, container }: RepositoriesProviderProps) {
  const [resolved, setResolved] = useState<AppContainer | null>(container ?? null);

  useEffect(() => {
    if (container) {
      setResolved(container);
      return;
    }
    let mounted = true;
    loadAppContainer()
      .catch(() => loadAppContainer(new InMemorySqliteDriver()))
      .then((loaded) => {
        if (mounted) setResolved(loaded);
      });
    return () => {
      mounted = false;
    };
  }, [container]);

  if (!resolved) {
    return null;
  }

  return (
    <RepositoriesContext.Provider value={resolved}>
      {children}
    </RepositoriesContext.Provider>
  );
}

export function useRepositories(): AppContainer {
  const ctx = useContext(RepositoriesContext);
  if (!ctx) {
    throw new Error('useRepositories deve ser utilizado dentro de um RepositoriesProvider.');
  }
  return ctx;
}
