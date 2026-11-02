import React from 'react';
import { StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FavoritesScreen } from '../../src/adapters/screens/FavoritesScreen';
import { useRepositories } from '../../src/adapters/context/RepositoriesContext';
import { RequireAccess } from '../../src/adapters/guards/RequireAccess';

export default function FavoritesTab() {
  const router = useRouter();
  // Fase 2: repositórios SQLite compostos pelo RepositoriesProvider
  // (identidade vem da sessão: favoritos são privados por usuário — §15.1).
  const { animalRepository, favoriteRepository } = useRepositories();
  // Remontar no foco garante que a lista reflita favoritos adicionados/
  // removidos nos detalhes.
  const [focusKey, setFocusKey] = React.useState(0);
  useFocusEffect(
    React.useCallback(() => {
      setFocusKey((k) => k + 1);
    }, [])
  );

  return (
    <RequireAccess area="FAVORITES">
      {(user) => (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <FavoritesScreen
            key={focusKey}
            animalRepository={animalRepository}
            favoriteRepository={favoriteRepository}
            currentUserId={user.id}
            onSelectAnimal={(animal) =>
              router.push({ pathname: '/animal/[id]', params: { id: animal.id } })
            }
          />
        </SafeAreaView>
      )}
    </RequireAccess>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
});
