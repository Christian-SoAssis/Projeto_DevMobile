import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimalDetailsScreen } from '../../src/adapters/screens/AnimalDetailsScreen';
import {
  DEMO_OWNER_ID,
  DEMO_USER_ID,
  animalRepository,
  favoriteRepository,
  interestRepository,
  syncQueueRepository,
} from '../../src/adapters/demo/sharedFakes';

export default function AnimalDetailsRoute() {
  const router = useRouter();
  const { id, asOwner } = useLocalSearchParams<{ id: string; asOwner?: string }>();
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
        // Identidade 100% mock: Meus anúncios abre com ?asOwner=1 (dono, pode
        // marcar adotado, NÃO pode favoritar o próprio anúncio). Início e
        // Favoritos abrem sem o parâmetro (visitante usr_2: pode favoritar —
        // e o favorito fica visível na aba Favoritos, que lista usr_2).
        currentUserId={asOwner === '1' ? DEMO_OWNER_ID : DEMO_USER_ID}
        animalRepository={animalRepository}
        favoriteRepository={favoriteRepository}
        interestRepository={interestRepository}
        syncQueueRepository={syncQueueRepository}
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

