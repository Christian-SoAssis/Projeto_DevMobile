import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Animal } from '../../domain/entities/Animal';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';

export interface MyAnimalsScreenProps {
  animalRepository: AnimalRepository;
  ownerId?: string;
  onSelectAnimal?: (animal: Animal) => void;
  onNewAnimal?: () => void;
  onBack?: () => void;
}

export const MyAnimalsScreen: React.FC<MyAnimalsScreenProps> = ({
  animalRepository,
  ownerId = 'usr_1',
  onSelectAnimal,
  onNewAnimal,
  onBack,
}) => {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAnimals = useCallback(async () => {
    setLoading(true);
    try {
      setAnimals(await animalRepository.listByOwner(ownerId));
    } finally {
      setLoading(false);
    }
  }, [animalRepository, ownerId]);

  useEffect(() => {
    loadAnimals();
  }, [loadAnimals]);

  return (
    <View style={styles.container} testID="my-animals-screen">
      {onBack && (
        <TouchableOpacity style={styles.backButton} onPress={onBack} testID="my-animals-back">
          <Text style={styles.backText}>‹ Voltar</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.title} testID="my-animals-title">
        Meus Anúncios ({animals.length})
      </Text>
      {onNewAnimal && (
        <TouchableOpacity
          style={styles.newButton}
          onPress={onNewAnimal}
          testID="new-animal-button"
        >
          <Text style={styles.newButtonText}>＋ Novo anúncio</Text>
        </TouchableOpacity>
      )}
      {loading ? (
        <ActivityIndicator size="large" color="#0066cc" testID="my-animals-loading" />
      ) : (
        <FlatList
          data={animals}
          keyExtractor={(item) => item.id}
          testID="my-animals-list"
          ListEmptyComponent={
            <Text style={styles.emptyText} testID="empty-my-animals">
              Você ainda não publicou nenhum anúncio.
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => onSelectAnimal && onSelectAnimal(item)}
              testID={`my-animal-card-${item.id}`}
            >
              <Text style={styles.animalName}>{item.name}</Text>
              <Text style={styles.animalDetails}>{item.characteristics.summary()}</Text>
              <Text style={styles.statusText}>
                {item.status.isAdopted() ? 'Adotado' : 'Disponível'}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#f5f5f7',
    padding: 16,
  },
  backButton: {
    marginBottom: 8,
  },
  backText: {
    color: '#0066cc',
    fontSize: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 12,
  },
  newButton: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  newButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderColor: '#e5e5ea',
    borderWidth: 1,
  },
  animalName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1c1c1e',
  },
  animalDetails: {
    fontSize: 14,
    color: '#48484a',
    marginTop: 4,
  },
  statusText: {
    fontSize: 13,
    color: '#28a745',
    fontWeight: 'bold',
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 24,
    color: '#8e8e93',
  },
});
