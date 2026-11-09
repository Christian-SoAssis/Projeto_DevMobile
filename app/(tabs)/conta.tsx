import { useFocusRefresh } from '../../src/adapters/hooks/useFocusRefresh';
import React from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccountScreen } from '../../src/adapters/screens/AccountScreen';
import { useAuth } from '../../src/adapters/context/AuthContext';
import { useRepositories } from '../../src/adapters/context/RepositoriesContext';

export default function ContaTab() {
  const router = useRouter();
  const refreshToken = useFocusRefresh();
  const { user, isLoading, logout, updateProfile } = useAuth();
  const { cameraGateway, animalRepository, interestRepository, remoteInterests, syncQueueRepository } = useRepositories();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AccountScreen refreshToken={refreshToken}
        user={user}
        syncQueueRepository={syncQueueRepository}
        isLoading={isLoading}
        cameraGateway={cameraGateway}
        animalRepository={animalRepository}
        interestRepository={interestRepository}
        remoteInterests={remoteInterests}
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
