import React from 'react';
import { useRouter } from 'expo-router';
import { FavoritesScreen } from '../../src/adapters/screens/FavoritesScreen';
import {
  DEMO_USER_ID,
  animalRepository,
  favoriteRepository,
} from '../../src/adapters/demo/sharedFakes';

export default function FavoritesTab() {
  const router = useRouter();

  return (
    <FavoritesScreen
      animalRepository={animalRepository}
      favoriteRepository={favoriteRepository}
      currentUserId={DEMO_USER_ID}
      onSelectAnimal={(animal) =>
        router.push({ pathname: '/animal/[id]', params: { id: animal.id } })
      }
    />
  );
}
