import React from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimalFormScreen } from '../../src/adapters/screens/AnimalFormScreen';
import { useRepositories } from '../../src/adapters/context/RepositoriesContext';
import { useConnectivity } from '../../src/adapters/hooks/useConnectivity';
import { RequireAccess } from '../../src/adapters/guards/RequireAccess';

export default function NovoAnuncioRoute() {
  const router = useRouter();
  // Fase 2: repositórios SQLite + conectividade real (cria online/offline
  // com fila de sincronização quando sem internet — RF17–RF19).
  const { animalRepository, syncQueueRepository, unitOfWork, cameraGateway, locationGateway, photoStorage } =
    useRepositories();
  const isOnline = useConnectivity();

  return (
    <RequireAccess area="MANAGE_ANIMAL">
      {(user) => (
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
          <AnimalFormScreen
            ownerId={user.id}
            animalRepository={animalRepository}
            syncQueueRepository={syncQueueRepository}
            unitOfWork={unitOfWork}
            cameraGateway={cameraGateway}
            locationGateway={locationGateway}
            photoStorage={photoStorage}
            isOnline={isOnline}
            onSuccess={() => router.back()}
          />
        </SafeAreaView>
      )}
    </RequireAccess>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
