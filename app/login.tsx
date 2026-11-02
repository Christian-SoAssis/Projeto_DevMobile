import React from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoginScreen } from '../src/adapters/screens/LoginScreen';
import { useAuth } from '../src/adapters/context/AuthContext';
import { useRepositories } from '../src/adapters/context/RepositoriesContext';

export default function LoginRoute() {
  const router = useRouter();
  const { login } = useAuth();
  const { remoteMode } = useRepositories();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <LoginScreen
        onLogin={login}
        onSuccess={() => router.replace('/(tabs)')}
        onGoToRegister={() => router.push('/cadastro')}
        onContinueAsVisitor={() => router.replace('/(tabs)')}
        demoHint={
          remoteMode === 'supabase'
            ? undefined
            : 'Modo demonstração (sem servidor): use ana@exemplo.com ou carlos@exemplo.com com qualquer senha.'
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
});
