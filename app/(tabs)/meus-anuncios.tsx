import React from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MyAnimalsScreen } from '../../src/adapters/screens/MyAnimalsScreen';
import { DEMO_OWNER_ID, animalRepository, syncQueueRepository } from '../../src/adapters/demo/sharedFakes';

export default function MeusAnunciosTab() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <MyAnimalsScreen
        animalRepository={animalRepository}
        syncQueueRepository={syncQueueRepository}
        ownerId={DEMO_OWNER_ID}
        onSelectAnimal={(animal) =>
          router.push({ pathname: '/animal/[id]', params: { id: animal.id } })
        }
        onEditAnimal={(animal) =>
          router.push({ pathname: '/(protected)/editar-anuncio', params: { id: animal.id } })
        }
        onNewAnimal={() => router.push('/(protected)/novo-anuncio')}
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
