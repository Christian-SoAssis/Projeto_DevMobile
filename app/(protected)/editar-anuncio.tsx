import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnimalFormScreen } from '../../src/adapters/screens/AnimalFormScreen';
import {
  DEMO_OWNER_ID,
  animalRepository,
  syncQueueRepository,
} from '../../src/adapters/demo/sharedFakes';

export default function EditarAnuncioRoute() {
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

  let content = null;

  if (loading) {
    content = (
      <View style={styles.center} testID="edit-loading">
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  } else if (!animal) {
    content = (
      <View style={styles.center} testID="edit-not-found">
        <Text style={styles.message}>Anúncio não encontrado para edição.</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          testID="edit-back"
        >
          <Text style={styles.backText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  } else {
    content = (
      <AnimalFormScreen
        ownerId={DEMO_OWNER_ID}
        initialAnimal={animal}
        animalRepository={animalRepository}
        syncQueueRepository={syncQueueRepository}
        onSuccess={() => router.back()}
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
    backgroundColor: '#fff',
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

