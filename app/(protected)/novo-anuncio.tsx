import React from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimalFormScreen } from '../../src/adapters/screens/AnimalFormScreen';
import { useRepositories } from '../../src/adapters/context/RepositoriesContext';
import { useConnectivity } from '../../src/adapters/hooks/useConnectivity';
import { DEMO_OWNER_ID } from '../../src/adapters/demo/sharedFakes';

export default function NovoAnuncioRoute() {
  const router = useRouter();
  // Fase 2: repositórios SQLite + conectividade real (cria online/offline
  // com fila de sincronização quando sem internet — RF17–RF19).
  const { animalRepository, syncQueueRepository, unitOfWork } = useRepositories();
  const isOnline = useConnectivity();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <AnimalFormScreen
        ownerId={DEMO_OWNER_ID}
        animalRepository={animalRepository}
        syncQueueRepository={syncQueueRepository}
        unitOfWork={unitOfWork}
        isOnline={isOnline}
        onSuccess={() => router.back()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
