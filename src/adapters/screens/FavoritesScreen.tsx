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
import { FavoriteRepository } from '../../domain/ports/FavoriteRepository';

export interface FavoritesScreenProps {
  animalRepository: AnimalRepository;
  favoriteRepository: FavoriteRepository;
  currentUserId?: string;
  onSelectAnimal?: (animal: Animal) => void;
  onBack?: () => void;
}

export const FavoritesScreen: React.FC<FavoritesScreenProps> = ({
  animalRepository,
  favoriteRepository,
  currentUserId = 'usr_2',
  onSelectAnimal,
  onBack,
}) => {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFavorites = useCallback(async () => {
    setLoading(true);
    try {
      const favorites = await favoriteRepository.listByUser(currentUserId);
      const found: Animal[] = [];
      for (const fav of favorites) {
        const animal = await animalRepository.findById(fav.animalId);
        if (animal) found.push(animal);
      }
      setAnimals(found);
    } finally {
      setLoading(false);
    }
  }, [animalRepository, favoriteRepository, currentUserId]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  return (
    <View style={styles.container} testID="favorites-screen">
      {onBack && (
        <TouchableOpacity style={styles.backButton} onPress={onBack} testID="favorites-back">
          <Text style={styles.backText}>‹ Voltar</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.title} testID="favorites-title">
        Meus Favoritos ({animals.length})
      </Text>
      {loading ? (
        <ActivityIndicator size="large" color="#0066cc" testID="favorites-loading" />
      ) : (
        <FlatList
          data={animals}
          keyExtractor={(item) => item.id}
          testID="favorites-list"
          ListEmptyComponent={
            <Text style={styles.emptyText} testID="empty-favorites">
              Você ainda não favoritou nenhum anúncio.
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => onSelectAnimal && onSelectAnimal(item)}
              testID={`favorite-card-${item.id}`}
            >
              <Text style={styles.animalName}>{item.name}</Text>
              <Text style={styles.animalDetails}>{item.characteristics.summary()}</Text>
              <Text style={styles.locationText}>📍 {item.location.formatDisplayLocation()}</Text>
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
  locationText: {
    fontSize: 13,
    color: '#8e8e93',
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 24,
    color: '#8e8e93',
  },
});
