import React from 'react';
import { SyncStatusScreen } from '../../src/adapters/screens/SyncStatusScreen';
import { animalRepository, syncQueueRepository } from '../../src/adapters/demo/sharedFakes';

export default function SyncTab() {
  return (
    <SyncStatusScreen
      syncQueueRepository={syncQueueRepository}
      animalRepository={animalRepository}
    />
  );
}
