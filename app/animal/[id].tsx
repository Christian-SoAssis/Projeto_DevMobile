import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimalDetailsScreen } from '../../src/adapters/screens/AnimalDetailsScreen';
import { useRepositories } from '../../src/adapters/context/RepositoriesContext';
import { useAuth } from '../../src/adapters/context/AuthContext';
import { useFullSync } from '../../src/adapters/hooks/useFullSync';

export default function AnimalDetailsRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  // Detalhes são públicos (RF06); sem sessão o usuário é visitante.
  const { user } = useAuth();
  const runSync = useFullSync();
  // Fase 2: repositórios SQLite compostos pelo RepositoriesProvider.
  const {
    animalRepository,
    favoriteRepository,
    interestRepository,
    syncQueueRepository,
    unitOfWork,
    remoteInterests,
    remoteMode,
  } = useRepositories();
  const [animal, setAnimal] = React.useState<Awaited<
    ReturnType<typeof animalRepository.findById>
  > | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      setLoading(true);
      const found = await animalRepository.findById(String(id));
      setAnimal(found);
      setLoading(false);
    }
    load();
  }, [id, animalRepository]);

  let content = null;

  if (loading) {
    content = (
      <View style={styles.center} testID="details-loading">
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  } else if (!animal) {
    content = (
      <View style={styles.center} testID="details-not-found">
        <Text style={styles.message}>Anúncio não encontrado.</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          testID="details-back"
        >
          <Text style={styles.backText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  } else {
    content = (
      <AnimalDetailsScreen
        animal={animal}
        currentUserId={user?.id ?? null}
        onRequireLogin={() => router.push('/login')}
        interestContact={
          user
            ? { name: user.name, email: user.contactInfo.email, phone: user.contactInfo.phone }
            : undefined
        }
        remoteInterests={remoteInterests}
        animalRepository={animalRepository}
        favoriteRepository={favoriteRepository}
        interestRepository={interestRepository}
        syncQueueRepository={syncQueueRepository}
        unitOfWork={unitOfWork}
        onSync={remoteMode === 'supabase' ? runSync : undefined}
        onBack={() => router.back()}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f7',
    padding: 16,
  },
  message: {
    fontSize: 16,
    color: '#48484a',
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  backText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

