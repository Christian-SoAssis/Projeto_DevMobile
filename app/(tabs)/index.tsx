import React from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SearchScreen } from '../../src/adapters/screens/SearchScreen';
import { AccountBar } from '../../src/adapters/components/AccountBar';
import { useAuth } from '../../src/adapters/context/AuthContext';
import { animalRepository } from '../../src/adapters/demo/sharedFakes';

export default function HomeTab() {
  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AccountBar user={user} onLogin={() => router.push('/login')} onLogout={logout} />
      <SearchScreen
        animalRepository={animalRepository}
        onSelectAnimal={(animal) =>
          router.push({ pathname: '/animal/[id]', params: { id: animal.id } })
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
