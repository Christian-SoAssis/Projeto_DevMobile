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
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function boot() {
      try {
        const resolved = loadContainer ? await loadContainer() : await loadAppContainer();
        if (active) {
          setBootError(null);
          setContainer(resolved);
        }
      } catch (error) {
        // O app continua utilizável em modo demonstração, mas a falha não é
        // silenciosa: fica visível no banner e no console.
        console.warn('Falha ao abrir o SQLite local; usando dados de demonstração.', error);
        if (active) {
          setBootError(
            error instanceof Error ? error.message : 'Não foi possível abrir o armazenamento local.'
          );
          setContainer(demoContainer);
        }
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

  return (
    <RepositoriesContext.Provider value={container}>
      {bootError && (
        <View style={styles.fallbackBanner} testID="repos-fallback-banner">
          <Text style={styles.fallbackText}>
            Armazenamento local indisponível. Usando dados de demonstração — alterações não serão
            persistidas.
          </Text>
        </View>
      )}
      {children}
    </RepositoriesContext.Provider>
  );
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
  fallbackBanner: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    backgroundColor: '#8a1c1c',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  fallbackText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
});
