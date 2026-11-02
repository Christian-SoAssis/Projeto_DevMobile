import React from 'react';
import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { RepositoriesProvider } from '../src/adapters/context/RepositoriesContext';
import { AuthProviderBridge } from '../src/adapters/context/AuthContext';
import { AutoSync } from '../src/adapters/sync/AutoSync';
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
      {/* Fase 2: persistência local real (SQLite) + Fase 3: Supabase opcional.
          A ordem dos providers é: container primeiro, auth depois — o
          AuthProviderBridge entrega o SupabaseAuthGateway do container
          quando configurado, ou mantém o fake de demonstração (§0.1). */}
      <RepositoriesProvider>
        <AuthProviderBridge sessionStorage={AppSessionStorage}>
          <StatusBar style="dark" />
          <AutoSync />
          <Slot />
        </AuthProviderBridge>
      </RepositoriesProvider>
    </SafeAreaProvider>
  );
}
