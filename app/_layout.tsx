import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RepositoriesProvider } from '../src/adapters/context/RepositoriesContext';
import { AuthProvider } from '../src/adapters/context/AuthContext';
import { AutoSync } from '../src/adapters/sync/AutoSync';
import { COLORS } from '../src/adapters/theme/tokens';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: COLORS.ivory }}>
      <SafeAreaProvider>
        <RepositoriesProvider>
          <AuthProvider>
            <AutoSync />
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: COLORS.ivory },
              }}
            />
          </AuthProvider>
        </RepositoriesProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
