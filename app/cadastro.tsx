import React from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/adapters/context/AuthContext';
import { RegisterScreen } from '../src/adapters/screens/RegisterScreen';

export default function CadastroRoute() {
  const router = useRouter();
  const { register } = useAuth();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <RegisterScreen
        onRegister={register}
        // Conta criada e já conectada → direto para o app; senão, login (confirmar e-mail).
        onSuccess={(_user, _needsEmailConfirmation, loggedIn) =>
          router.replace(loggedIn ? '/(tabs)' : '/login')
        }
        onGoToLogin={() => router.replace('/login')}
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
