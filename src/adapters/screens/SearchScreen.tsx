import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Animal } from '../../domain/entities/Animal';
import { AnimalFilterOptions, AnimalRepository } from '../../domain/ports/AnimalRepository';
import { SearchAnimalsUseCase } from '../../application/use-cases/SearchAnimalsUseCase';

export interface SearchScreenProps {
  animalRepository: AnimalRepository;
  onSelectAnimal?: (animal: Animal) => void;
  isOnlineInitial?: boolean;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({
  animalRepository,
  onSelectAnimal,
  isOnlineInitial = true,
}) => {
  const [query, setQuery] = useState('');
  const [selectedSpecies, setSelectedSpecies] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!isOnlineInitial);

  const performSearch = async () => {
    setLoading(true);
    try {
      const filters: AnimalFilterOptions = {
        searchQuery: query,
        species: selectedSpecies || undefined,
      };
      const useCase = new SearchAnimalsUseCase(animalRepository);
      const res = await useCase.execute(filters, !isOffline);
      setAnimals(res.animals);
      setIsOffline(res.isOffline);
    } catch {
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    performSearch();
  }, [selectedSpecies]);

  return (
    <View style={styles.container} testID="search-screen">
      {/* Network / Offline Banner */}
      <View
        style={[styles.banner, isOffline ? styles.bannerOffline : styles.bannerOnline]}
        testID="connection-banner"
      >
        <Text style={styles.bannerText}>
          {isOffline ? 'Modo Offline — Exibindo anúncios em cache' : 'Conectado — Dados Atualizados'}
        </Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Pesquisar por nome ou cidade..."
          value={query}
          onChangeText={setQuery}
          testID="search-input"
        />
        <TouchableOpacity style={styles.searchButton} onPress={performSearch} testID="search-button">
          <Text style={styles.buttonText}>Buscar</Text>
        </TouchableOpacity>
      </View>

      {/* Species Filter Pills */}
      <View style={styles.filterRow}>
        {['Todos', 'Cão', 'Gato'].map((sp) => {
          const active = (sp === 'Todos' && !selectedSpecies) || selectedSpecies === sp;
          return (
            <TouchableOpacity
              key={sp}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSelectedSpecies(sp === 'Todos' ? '' : sp)}
              testID={`filter-chip-${sp}`}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{sp}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List / Map View Toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
          onPress={() => setViewMode('list')}
          testID="toggle-list"
        >
          <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>Lista</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, viewMode === 'map' && styles.toggleBtnActive]}
          onPress={() => setViewMode('map')}
          testID="toggle-map"
        >
          <Text style={[styles.toggleText, viewMode === 'map' && styles.toggleTextActive]}>Mapa</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#0066cc" testID="loading-indicator" style={styles.loader} />
      ) : viewMode === 'map' ? (
        <View style={styles.mapContainer} testID="map-view">
          <Text style={styles.mapTitle}>Visualização em Mapa (Localizações Aproximadas)</Text>
          {animals.map((item) => (
            <Text key={item.id} style={styles.pinText} testID={`map-pin-${item.id}`}>
              📍 {item.name} ({item.location.neighborhood}, {item.location.city})
            </Text>
          ))}
        </View>
      ) : (
        <FlatList
          data={animals}
          keyExtractor={(item) => item.id}
          testID="animals-list"
          ListEmptyComponent={
            <Text style={styles.emptyText} testID="empty-message">
              Nenhum animal encontrado para estes critérios.
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => onSelectAnimal && onSelectAnimal(item)}
              testID={`animal-card-${item.id}`}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.animalName}>{item.name}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    item.status.isAdopted() ? styles.badgeAdopted : styles.badgeAvailable,
                  ]}
                >
                  <Text style={styles.statusBadgeText}>
                    {item.status.isAdopted() ? 'Adotado' : 'Disponível'}
                  </Text>
                </View>
              </View>
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
  banner: {
    padding: 8,
    borderRadius: 6,
    marginBottom: 12,
    alignItems: 'center',
  },
  bannerOffline: {
    backgroundColor: '#fff3cd',
  },
  bannerOnline: {
    backgroundColor: '#d4edda',
  },
  bannerText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
  },
  searchRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  searchButton: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  chip: {
    backgroundColor: '#e5e5ea',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginRight: 8,
  },
  chipActive: {
    backgroundColor: '#0066cc',
  },
  chipText: {
    fontSize: 14,
    color: '#333',
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  toggleRow: {
    flexDirection: 'row',
    marginBottom: 12,
    backgroundColor: '#e5e5ea',
    borderRadius: 8,
    padding: 2,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: '#fff',
  },
  toggleText: {
    fontSize: 14,
    color: '#666',
  },
  toggleTextActive: {
    color: '#0066cc',
    fontWeight: 'bold',
  },
  loader: {
    marginTop: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderColor: '#e5e5ea',
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  animalName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1c1c1e',
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  badgeAvailable: {
    backgroundColor: '#28a745',
  },
  badgeAdopted: {
    backgroundColor: '#6c757d',
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  animalDetails: {
    fontSize: 14,
    color: '#48484a',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#8e8e93',
  },
  mapContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  pinText: {
    fontSize: 14,
    marginVertical: 4,
    color: '#333',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 24,
    color: '#8e8e93',
  },
});
