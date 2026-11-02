import React from 'react';
import { Stack } from 'expo-router';
import { RequireAccess } from '../../src/adapters/guards/RequireAccess';

/** Tudo em (protected) exige usuário autenticado (RF08–RF13). */
export default function ProtectedLayout() {
  return (
    <RequireAccess area="MANAGE_ANIMAL">
      {() => <Stack screenOptions={{ headerShown: false }} />}
    </RequireAccess>
  );
}
