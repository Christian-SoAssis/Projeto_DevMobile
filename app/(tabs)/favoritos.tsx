import React from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FavoritesScreen } from '../../src/adapters/screens/FavoritesScreen';
import {
  DEMO_USER_ID,
  animalRepository,
  favoriteRepository,
} from '../../src/adapters/demo/sharedFakes';

export default function FavoritesTab() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <FavoritesScreen
        animalRepository={animalRepository}
        favoriteRepository={favoriteRepository}
        currentUserId={DEMO_USER_ID}
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
