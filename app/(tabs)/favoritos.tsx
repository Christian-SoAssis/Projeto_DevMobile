import React from 'react';
import { StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FavoritesScreen } from '../../src/adapters/screens/FavoritesScreen';
import {
  DEMO_USER_ID,
  animalRepository,
  favoriteRepository,
} from '../../src/adapters/demo/sharedFakes';

export default function FavoritesTab() {
  const router = useRouter();
  // Tabs mantêm a tela montada; remontar no foco garante que a lista
  // reflita favoritos adicionados/removidos nos detalhes (100% mock,
  // só expo-router — sem SQLite/Supabase/sensores).
  const [focusKey, setFocusKey] = React.useState(0);
  useFocusEffect(
    React.useCallback(() => {
      setFocusKey((k) => k + 1);
    }, [])
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <FavoritesScreen
        key={focusKey}
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
