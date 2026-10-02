import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { AnimalDetailsScreen } from '../../src/adapters/screens/AnimalDetailsScreen';
import {
  DEMO_USER_ID,
  animalRepository,
  favoriteRepository,
  interestRepository,
  syncQueueRepository,
} from '../../src/adapters/demo/sharedFakes';

export default function AnimalDetailsRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
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
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center} testID="details-loading">
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  if (!animal) {
    return (
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
  }

  return (
    <AnimalDetailsScreen
      animal={animal}
      currentUserId={DEMO_USER_ID}
      animalRepository={animalRepository}
      favoriteRepository={favoriteRepository}
      interestRepository={interestRepository}
      syncQueueRepository={syncQueueRepository}
      onBack={() => router.back()}
    />
  );
}

const styles = StyleSheet.create({
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
