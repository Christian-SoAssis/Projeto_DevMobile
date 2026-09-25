import React from 'react';
import { AuthProvider } from '../src/adapters/context/AuthContext';
import { Slot } from 'expo-router';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Slot />
    </AuthProvider>
  );
}
