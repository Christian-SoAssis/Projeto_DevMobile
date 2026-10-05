import React from 'react';
import { useRouter } from 'expo-router';
import { RegisterScreen } from '../src/adapters/screens/RegisterScreen';

export default function CadastroRoute() {
  const router = useRouter();

  return <RegisterScreen onSuccess={() => router.push('/login')} />;
}
