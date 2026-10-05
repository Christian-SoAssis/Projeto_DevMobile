import React from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimalFormScreen } from '../../src/adapters/screens/AnimalFormScreen';
import {
  DEMO_OWNER_ID,
  animalRepository,
  syncQueueRepository,
} from '../../src/adapters/demo/sharedFakes';

export default function NovoAnuncioRoute() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <AnimalFormScreen
        ownerId={DEMO_OWNER_ID}
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

