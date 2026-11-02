import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SyncStatusScreen } from '../../src/adapters/screens/SyncStatusScreen';
import { RequireAccess } from '../../src/adapters/guards/RequireAccess';
import { useRepositories } from '../../src/adapters/context/RepositoriesContext';

export default function SyncTab() {
  // Fase 2: fila e repositório persistidos no SQLite ao sincronizar.
  const { animalRepository, syncQueueRepository } = useRepositories();

  return (
    <RequireAccess area="SYNC">
      {() => (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <SyncStatusScreen
            syncQueueRepository={syncQueueRepository}
            animalRepository={animalRepository}
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
