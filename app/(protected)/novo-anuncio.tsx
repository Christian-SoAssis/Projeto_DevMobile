import React from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimalFormScreen } from '../../src/adapters/screens/AnimalFormScreen';
import {
  animalRepository,
  syncQueueRepository,
} from '../../src/adapters/demo/sharedFakes';
import { useAuth } from '../../src/adapters/context/AuthContext';

export default function NovoAnuncioRoute() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <AnimalFormScreen
        ownerId={user?.id ?? ''}
        animalRepository={animalRepository}
        syncQueueRepository={syncQueueRepository}
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

