import React from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SearchScreen } from '../../src/adapters/screens/SearchScreen';
import { useRepositories } from '../../src/adapters/context/RepositoriesContext';
import { useConnectivity } from '../../src/adapters/hooks/useConnectivity';

export default function HomeTab() {
  const router = useRouter();
  // Fase 2: repositórios SQLite compostos pelo RepositoriesProvider.
  const { animalRepository } = useRepositories();
  // Fase 2: conectividade real (NetInfo) alimenta o estado offline inicial.
  const isOnline = useConnectivity();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <SearchScreen
        animalRepository={animalRepository}
        isOnlineInitial={isOnline}
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
