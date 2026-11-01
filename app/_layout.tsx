import React from 'react';
import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/adapters/context/AuthContext';
import { RepositoriesProvider } from '../src/adapters/context/RepositoriesContext';
import { SessionStorageSecureStore } from '../src/adapters/auth/SessionStorageSecureStore';

/**
 * Sessão segura real do app (Keychain/Keystore via expo-secure-store).
 * O adapter degrada para memória em ambientes sem ponte nativa,
 * mantendo os testes e o modo demo estáveis.
 */
const AppSessionStorage = new SessionStorageSecureStore();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider sessionStorage={AppSessionStorage}>
        {/* Fase 2: compõe a persistência local real (SQLite) uma única vez
            e entrega os repositorios via useRepositories(). */}
        <RepositoriesProvider>
          <StatusBar style="dark" />
          <Slot />
        </RepositoriesProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
