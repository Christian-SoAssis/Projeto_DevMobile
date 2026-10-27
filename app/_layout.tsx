import React from 'react';
import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/adapters/context/AuthContext';
import { RepositoriesProvider } from '../src/adapters/context/RepositoriesContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
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
