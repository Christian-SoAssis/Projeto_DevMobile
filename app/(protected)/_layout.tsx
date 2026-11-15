import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../src/adapters/context/AuthContext';

export default function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (!loading && !user) {
    return <Redirect href="/(public)/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
