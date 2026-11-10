import { useFocusRefresh } from '../../src/adapters/hooks/useFocusRefresh';
import React from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SearchScreen } from '../../src/adapters/screens/SearchScreen';
import { useRepositories } from '../../src/adapters/context/RepositoriesContext';
import { useConnectivity } from '../../src/adapters/hooks/useConnectivity';
import { useAuth } from '../../src/adapters/context/AuthContext';
import { useFullSync } from '../../src/adapters/hooks/useFullSync';
import { OnboardingProgressCard } from '../../src/adapters/components/OnboardingProgressCard';

export default function HomeTab() {
  const router = useRouter();
  const refreshToken = useFocusRefresh();
  const runSync = useFullSync();
  // Fase 2: repositórios SQLite compostos pelo RepositoriesProvider.
  // RF04: o GPS do container fornece a origem do filtro por distância.
  const { animalRepository, syncQueueRepository, locationGateway, remoteMode } = useRepositories();
  // Fase 2: conectividade real (NetInfo) alimenta o estado offline inicial.
  const isOnline = useConnectivity();
  // Progress card de onboarding (melhoria #12): derivado da sessão real;
  // visitante (sem user) não vê card.
  const { user } = useAuth();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <OnboardingProgressCard refreshToken={refreshToken}
        user={user}
        animalRepository={animalRepository}
        onGoToAccount={() => router.push('/(tabs)/conta')}
        onNewAnimal={() => router.push('/(protected)/novo-anuncio')}
      />
      <SearchScreen
        animalRepository={animalRepository}
        syncQueueRepository={syncQueueRepository}
        locationGateway={locationGateway}
        isOnlineInitial={isOnline}
        onSync={remoteMode === 'supabase' ? runSync : undefined}
        onSelectAnimal={(animal) =>
          router.push({ pathname: '/animal/[id]', params: { id: animal.id } })
        }
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
