import React from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FavoritesScreen } from '../../src/adapters/screens/FavoritesScreen';
import { LoginRequired } from '../../src/adapters/components/LoginRequired';
import { useAuth } from '../../src/adapters/context/AuthContext';
import { useFocusKey } from '../../src/adapters/hooks/useFocusKey';
import { animalRepository, favoriteRepository } from '../../src/adapters/demo/sharedFakes';

export default function FavoritesTab() {
  const router = useRouter();
  const { user } = useAuth();
  const focusKey = useFocusKey();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {user ? (
        <FavoritesScreen
          key={focusKey}
          animalRepository={animalRepository}
          favoriteRepository={favoriteRepository}
          currentUserId={user.id}
          onSelectAnimal={(animal) =>
            router.push({ pathname: '/animal/[id]', params: { id: animal.id } })
          }
        />
      ) : (
        <LoginRequired
          message="Entre na sua conta para ver seus favoritos."
          onLogin={() => router.push('/login')}
          onRegister={() => router.push('/cadastro')}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
});
