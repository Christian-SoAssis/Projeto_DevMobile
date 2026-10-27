import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/adapters/context/AuthContext';
import { authGateway, sessionStorage } from '../src/adapters/demo/sharedFakes';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider authGateway={authGateway} sessionStorage={sessionStorage}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
