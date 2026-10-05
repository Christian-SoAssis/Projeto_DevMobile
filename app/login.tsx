import React from 'react';
import { useRouter } from 'expo-router';
import { LoginScreen } from '../src/adapters/screens/LoginScreen';

export default function LoginRoute() {
  const router = useRouter();

  return <LoginScreen onSuccess={() => router.push('/(tabs)')} />;
}
