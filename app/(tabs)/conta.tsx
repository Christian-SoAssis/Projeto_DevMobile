import React from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccountScreen } from '../../src/adapters/screens/AccountScreen';
import { useAuth } from '../../src/adapters/context/AuthContext';
import { useRepositories } from '../../src/adapters/context/RepositoriesContext';

export default function ContaTab() {
  const router = useRouter();
  const { user, isLoading, logout, updateProfile } = useAuth();
  const { cameraGateway } = useRepositories();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AccountScreen
        user={user}
        isLoading={isLoading}
        cameraGateway={cameraGateway}
        onLogin={() => router.push('/login')}
        onRegister={() => router.push('/cadastro')}
        onSaveProfile={updateProfile}
        onLogout={async () => {
          await logout();
          router.replace('/(tabs)');
        }}
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
