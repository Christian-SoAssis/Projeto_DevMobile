import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SyncStatusScreen } from '../../src/adapters/screens/SyncStatusScreen';
import { animalRepository, syncQueueRepository } from '../../src/adapters/demo/sharedFakes';

export default function SyncTab() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <SyncStatusScreen
        syncQueueRepository={syncQueueRepository}
        animalRepository={animalRepository}
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
