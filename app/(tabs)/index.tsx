import React from 'react';
import { useRouter } from 'expo-router';
import { SearchScreen } from '../../src/adapters/screens/SearchScreen';
import { animalRepository } from '../../src/adapters/demo/sharedFakes';

export default function HomeTab() {
  const router = useRouter();

  return (
    <SearchScreen
      animalRepository={animalRepository}
      onSelectAnimal={(animal) =>
        router.push({ pathname: '/animal/[id]', params: { id: animal.id } })
      }
    />
  );
}
