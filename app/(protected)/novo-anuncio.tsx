import React from 'react';
import { useRouter } from 'expo-router';
import { AnimalFormScreen } from '../../src/adapters/screens/AnimalFormScreen';
import {
  DEMO_OWNER_ID,
  animalRepository,
  syncQueueRepository,
} from '../../src/adapters/demo/sharedFakes';

export default function NovoAnuncioRoute() {
  const router = useRouter();

  return (
    <AnimalFormScreen
      ownerId={DEMO_OWNER_ID}
      animalRepository={animalRepository}
      syncQueueRepository={syncQueueRepository}
      onSuccess={() => router.back()}
    />
  );
}
