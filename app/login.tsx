import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoginScreen } from '../src/adapters/screens/LoginScreen';
import { useAuth } from '../src/adapters/context/AuthContext';

export default function LoginRoute() {
  const router = useRouter();
  const { login } = useAuth();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <LoginScreen
        onLogin={login}
        onSuccess={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
      />
      <TouchableOpacity style={styles.link} onPress={() => router.push('/cadastro')} testID="go-register">
        <Text style={styles.linkText}>Ainda não tem conta? Criar conta</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  link: {
    alignItems: 'center',
    padding: 16,
  },
  linkText: {
    color: '#0066cc',
    fontSize: 15,
  },
});
