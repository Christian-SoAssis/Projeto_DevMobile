import React, { createContext, useContext, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { loadAppContainer, AppContainer } from '../../infrastructure/composition/loadAppContainer';
import { demoContainer } from '../demo/sharedFakes';

const RepositoriesContext = createContext<AppContainer | null>(null);

export interface RepositoriesProviderProps {
  children: React.ReactNode;
  /** Injetável para testes. Padrão: composição SQLite real (`loadAppContainer`). */
  loadContainer?: () => Promise<AppContainer>;
}

/**
 * Provider que compõe a persistência local real (SQLite, Fase 2) uma única
 * vez na inicialização do app e entrega os repositorios via Context API.
 *
 * Regras (doc §13.1): nenhum componente visual importa SQLite/Supabase —
 * as rotas consomem os ports por `useRepositories()`, escolhendo entre o
 * container SQLite (app real) e o container demo em memória (fallback).
 */
export function RepositoriesProvider({ children, loadContainer }: RepositoriesProviderProps) {
  const [container, setContainer] = useState<AppContainer | null>(null);

  useEffect(() => {
    let active = true;
    async function boot() {
      try {
        const resolved = loadContainer ? await loadContainer() : await loadAppContainer();
        if (active) setContainer(resolved);
      } catch {
        // Sem perda silenciosa: se o container real não puder ser criado,
        // o app segue com a persistência demo em memória.
        if (active) setContainer(demoContainer);
      }
    }
    boot();
    return () => {
      active = false;
    };
  }, [loadContainer]);

  if (!container) {
    return (
      <View style={styles.center} testID="repos-loading">
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={styles.message}>Preparando armazenamento local…</Text>
      </View>
    );
  }

  return <RepositoriesContext.Provider value={container}>{children}</RepositoriesContext.Provider>;
}

/**
 * Repositórios do app. Fora do provider (testes de rotas/demos avulsas)
 * retorna o container demo, mantendo o comportamento anterior à Fase 2.
 */
export function useRepositories(): AppContainer {
  return useContext(RepositoriesContext) || demoContainer;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f7',
    padding: 16,
  },
  message: {
    fontSize: 14,
    color: '#48484a',
    marginTop: 12,
  },
});
