import React from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RegisterScreen } from '../src/adapters/screens/RegisterScreen';
import { authGateway } from '../src/adapters/demo/sharedFakes';

export default function CadastroRoute() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <RegisterScreen authGateway={authGateway} onSuccess={() => router.replace('/login')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
});

