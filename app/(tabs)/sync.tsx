import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SyncStatusScreen } from '../../src/adapters/screens/SyncStatusScreen';
import { useFocusKey } from '../../src/adapters/hooks/useFocusKey';
import { animalRepository, syncQueueRepository } from '../../src/adapters/demo/sharedFakes';

export default function SyncTab() {
  const focusKey = useFocusKey();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <SyncStatusScreen
        key={focusKey}
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
