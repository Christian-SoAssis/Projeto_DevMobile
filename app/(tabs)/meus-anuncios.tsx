import React from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MyAnimalsScreen } from '../../src/adapters/screens/MyAnimalsScreen';
import { useRepositories } from '../../src/adapters/context/RepositoriesContext';
import { RequireAccess } from '../../src/adapters/guards/RequireAccess';

export default function MeusAnunciosTab() {
  const router = useRouter();
  // Fase 2: repositórios SQLite compostos pelo RepositoriesProvider.
  const { animalRepository, syncQueueRepository, unitOfWork } = useRepositories();

  return (
    <RequireAccess area="MY_ANIMALS">
      {(user) => (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <MyAnimalsScreen
            animalRepository={animalRepository}
            syncQueueRepository={syncQueueRepository}
            unitOfWork={unitOfWork}
            ownerId={user.id}
            onSelectAnimal={(animal) =>
              router.push({ pathname: '/animal/[id]', params: { id: animal.id } })
            }
            onEditAnimal={(animal) =>
              router.push({ pathname: '/(protected)/editar-anuncio', params: { id: animal.id } })
            }
            onNewAnimal={() => router.push('/(protected)/novo-anuncio')}
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
