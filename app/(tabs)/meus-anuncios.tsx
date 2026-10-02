import React from 'react';
import { useRouter } from 'expo-router';
import { MyAnimalsScreen } from '../../src/adapters/screens/MyAnimalsScreen';
import { DEMO_OWNER_ID, animalRepository } from '../../src/adapters/demo/sharedFakes';

export default function MeusAnunciosTab() {
  const router = useRouter();

  return (
    <MyAnimalsScreen
      animalRepository={animalRepository}
      ownerId={DEMO_OWNER_ID}
      onSelectAnimal={(animal) =>
        router.push({ pathname: '/animal/[id]', params: { id: animal.id } })
      }
      onNewAnimal={() => router.push('/(protected)/novo-anuncio')}
    />
  );
}
