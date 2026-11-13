import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SyncStatusScreen } from '../../src/adapters/screens/SyncStatusScreen';
import { RequireAccess } from '../../src/adapters/guards/RequireAccess';
import { useRouter } from 'expo-router';
import { useFullSync } from '../../src/adapters/hooks/useFullSync';
import { useRepositories } from '../../src/adapters/context/RepositoriesContext';

export default function SyncTab() {
  // Fase 2: fila e repositório persistidos no SQLite ao sincronizar.
  const { animalRepository, syncQueueRepository, remotePhotoStorage, remoteMode } = useRepositories();
  const router = useRouter();
  const runSync = useFullSync();

  return (
    <RequireAccess area="SYNC">
      {() => (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <SyncStatusScreen
            syncQueueRepository={syncQueueRepository}
            animalRepository={animalRepository}
            remotePhotoStorage={remotePhotoStorage}
            remoteMode={remoteMode}
            runSync={remoteMode === 'supabase' ? runSync : undefined}
            onOpenConflicts={() => router.push('/(protected)/conflitos')}
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
