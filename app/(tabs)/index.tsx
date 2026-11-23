import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Animal } from '../../src/domain/entities/Animal';
import { useAuth } from '../../src/adapters/context/AuthContext';
import { useConnectivity } from '../../src/adapters/hooks/useConnectivity';
import { useFullSync } from '../../src/adapters/hooks/useFullSync';
import { useUseCases } from '../../src/adapters/hooks/useUseCases';
import { useSearchFilters } from '../../src/adapters/hooks/useSearchFilters';
import { subscribePullCompleted } from '../../src/adapters/sync/pullEvents';
import { EnlaceHeader } from '../../src/adapters/components/EnlaceHeader';
import {
  ANIMAL_FALLBACK_PHOTO,
  AnimalCard,
} from '../../src/adapters/components/AnimalCard';
import { SearchFilterModal } from '../../src/adapters/components/SearchFilterModal';
import {
  CLAY_CARD_STYLE,
  CLAY_INSET_INPUT_STYLE,
  COLORS,
  RADII,
} from '../../src/adapters/theme/tokens';

/**
 * V03 • Explorar: Lista | V04 • Explorar: Mapa | V05 • Filtros da busca
 */
export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isOnline = useConnectivity();
  const runFullSync = useFullSync();
  const { searchAnimalsUseCase, toggleFavoriteUseCase, listFavoriteIds } = useUseCases();

  const [viewMode, setViewMode] = useState<'LIST' | 'MAP'>('LIST');
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [selectedMapAnimal, setSelectedMapAnimal] = useState<Animal | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const filters = useSearchFilters();

  const loadData = useCallback(async () => {
    const list = await searchAnimalsUseCase.execute({
      query: filters.searchQuery,
      species: filters.species === 'Todos' ? undefined : filters.species,
      size: filters.size === 'Todos' ? undefined : filters.size,
      sex: filters.sex === 'Todos' ? undefined : filters.sex,
      approximateAge: filters.approximateAge || undefined,
      maxDistanceKm: filters.distanceKm,
      latitude:
        filters.distanceKm !== undefined ? filters.userCoords.latitude : undefined,
      longitude:
        filters.distanceKm !== undefined ? filters.userCoords.longitude : undefined,
      currentUserId: user?.id ?? null,
    });
    setAnimals(list);
    setSelectedMapAnimal((prev) =>
      prev && list.some((a) => a.id === prev.id) ? prev : list[0] ?? null
    );

    if (user) {
      setFavoriteIds(await listFavoriteIds(user.id));
    } else {
      setFavoriteIds(new Set());
    }
  }, [
    searchAnimalsUseCase,
    listFavoriteIds,
    filters.searchQuery,
    filters.species,
    filters.size,
    filters.sex,
    filters.approximateAge,
    filters.distanceKm,
    filters.userCoords,
    user,
  ]);

  useEffect(() => {
    void loadData();
    const unsub = subscribePullCompleted(() => {
      void loadData();
    });
    return unsub;
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const localReload = loadData();
      if (isOnline) {
        await Promise.race([
          runFullSync(),
          new Promise((resolve) => setTimeout(resolve, 800)),
        ]);
      } else {
        await localReload;
      }
    } catch (err) {
      console.warn('Erro ao atualizar feed:', err);
    } finally {
      setRefreshing(false);
    }
  }, [isOnline, runFullSync, loadData]);

  const handleToggleFavorite = async (animalId: string) => {
    if (!user) {
      router.push('/(public)/login');
      return;
    }
    await toggleFavoriteUseCase.execute(user.id, animalId, isOnline);
    await loadData();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <EnlaceHeader onLocationPress={() => filters.setFilterModalOpen(true)} />

      <View style={styles.topSection}>
        {viewMode === 'LIST' && (
          <Text style={styles.heroHeadline}>Encontre seu{'\n'}novo amigo</Text>
        )}

        <View style={styles.searchBarRow}>
          <View style={styles.searchInputBox}>
            <Ionicons name="search" size={18} color={COLORS.brown} />
            <TextInput
              style={styles.searchInput}
              placeholder="Nome ou cidade"
              placeholderTextColor={COLORS.brownMuted}
              value={filters.searchQuery}
              onChangeText={filters.setSearchQuery}
            />
            {filters.searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => filters.setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={COLORS.brownMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Abrir filtros da busca"
            onPress={() => filters.setFilterModalOpen(true)}
            style={styles.filterIconButton}
          >
            <Ionicons name="options-outline" size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {viewMode === 'LIST' && (
          <>
            <View style={styles.speciesPillsRow}>
              {(
                [
                  { label: 'Todos', value: 'Todos', icon: 'apps-outline' },
                  { label: 'Cães', value: 'Cão', icon: 'paw-outline' },
                  { label: 'Gatos', value: 'Gato', icon: 'happy-outline' },
                ] as const
              ).map((chip) => {
                const active = filters.species === chip.value;
                return (
                  <TouchableOpacity
                    key={chip.value}
                    accessibilityRole="button"
                    onPress={() => filters.setSpecies(chip.value)}
                    style={[styles.speciesChip, active && styles.speciesChipActive]}
                  >
                    <Ionicons
                      name={chip.icon}
                      size={15}
                      color={active ? COLORS.white : COLORS.terracotta}
                    />
                    <Text
                      style={[
                        styles.speciesChipText,
                        active && styles.speciesChipTextActive,
                      ]}
                    >
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.syncStatusRow}>
              <Ionicons
                name={isOnline ? 'checkmark-circle' : 'cloud-offline'}
                size={15}
                color={isOnline ? COLORS.green : COLORS.amber}
              />
              <Text style={styles.syncStatusText}>
                {isOnline ? 'Dados atualizados' : 'Modo Offline — Exibindo cache local'}
              </Text>
            </View>
          </>
        )}

        <View style={styles.segmentedToggle}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setViewMode('LIST')}
            style={[styles.segmentBtn, viewMode === 'LIST' && styles.segmentBtnActive]}
          >
            <Text
              style={[
                styles.segmentBtnText,
                viewMode === 'LIST' && styles.segmentBtnTextActive,
              ]}
            >
              Lista
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setViewMode('MAP')}
            style={[styles.segmentBtn, viewMode === 'MAP' && styles.segmentBtnActive]}
          >
            <Text
              style={[
                styles.segmentBtnText,
                viewMode === 'MAP' && styles.segmentBtnTextActive,
              ]}
            >
              Mapa
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'LIST' ? (
        <FlatList
          data={animals}
          keyExtractor={(item) => item.id}
          windowSize={7}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              testID="feed-refresh-control"
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.terracotta]}
              tintColor={COLORS.terracotta}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="paw-outline" size={38} color={COLORS.brownMuted} />
              <Text style={styles.emptyTitle}>Nenhum pet encontrado</Text>
              <Text style={styles.emptySubtitle}>
                Tente limpar os filtros ou buscar por outro bairro/cidade.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <AnimalCard
              animal={item}
              isFavorite={favoriteIds.has(item.id)}
              onPress={() => router.push(`/animal/${item.id}`)}
              onToggleFavorite={() => handleToggleFavorite(item.id)}
            />
          )}
        />
      ) : (
        <View style={styles.mapContainer}>
          <MapView
            provider="google"
            style={styles.mapCanvas}
            initialRegion={{
              latitude: -21.55,
              longitude: -45.43,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
            showsUserLocation
            showsMyLocationButton
          >
            {animals.map((item) => {
              const { latitude, longitude } = item.location;
              if (!latitude || !longitude || latitude === 0 || longitude === 0) {
                return null;
              }
              const isSelected = selectedMapAnimal?.id === item.id;
              return (
                <Marker
                  key={item.id}
                  coordinate={{ latitude, longitude }}
                  title={item.name}
                  description={item.location.displayLabel}
                  pinColor={isSelected ? COLORS.espresso : COLORS.terracotta}
                  onPress={() => setSelectedMapAnimal(item)}
                />
              );
            })}
          </MapView>

          {selectedMapAnimal && (
            <View style={styles.mapPreviewCard}>
              <Image
                source={{
                  uri:
                    selectedMapAnimal.photos[0]?.displayUri || ANIMAL_FALLBACK_PHOTO,
                }}
                style={styles.mapPreviewThumb}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.animalName}>{selectedMapAnimal.name}</Text>
                <Text style={styles.metaText}>
                  {selectedMapAnimal.location.displayLabel}
                </Text>
                <View style={styles.approxPrivacyRow}>
                  <Ionicons
                    name="information-circle-outline"
                    size={14}
                    color={COLORS.brown}
                  />
                  <Text style={styles.approxPrivacyText}>Localização aproximada</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => router.push(`/animal/${selectedMapAnimal.id}`)}
                style={styles.mapViewAdBtn}
              >
                <Text style={styles.mapViewAdBtnText}>Ver anúncio</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <SearchFilterModal
        visible={filters.filterModalOpen}
        species={filters.species}
        onChangeSpecies={filters.setSpecies}
        size={filters.size}
        onChangeSize={filters.setSize}
        sex={filters.sex}
        onChangeSex={filters.setSex}
        approximateAge={filters.approximateAge}
        onChangeApproximateAge={filters.setApproximateAge}
        distanceKm={filters.distanceKm}
        onChangeDistanceKm={filters.setDistanceKm}
        onClose={() => filters.setFilterModalOpen(false)}
        onClear={filters.clearFilters}
        onApply={filters.applyFilterModal}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.ivory,
  },
  topSection: {
    paddingHorizontal: 18,
  },
  heroHeadline: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.espresso,
    lineHeight: 31,
    marginBottom: 12,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  searchInputBox: {
    ...CLAY_INSET_INPUT_STYLE,
    flex: 1,
    minHeight: 46,
    borderRadius: RADII.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.espresso,
  },
  filterIconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.terracotta,
    borderWidth: 1.5,
    borderColor: COLORS.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speciesPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  speciesChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.cream,
    borderRadius: RADII.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: COLORS.peach,
  },
  speciesChipActive: {
    backgroundColor: COLORS.terracotta,
    borderColor: COLORS.terracottaDark,
  },
  speciesChipText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.espresso,
  },
  speciesChipTextActive: {
    color: COLORS.white,
  },
  syncStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginBottom: 8,
  },
  syncStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.brown,
  },
  segmentedToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.cream,
    borderRadius: RADII.pill,
    padding: 4,
    borderWidth: 1.5,
    borderColor: COLORS.peach,
    marginBottom: 10,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: RADII.pill,
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: COLORS.terracotta,
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.espresso,
  },
  segmentBtnTextActive: {
    color: COLORS.white,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 24,
    gap: 12,
  },
  animalName: {
    fontSize: 19,
    fontWeight: '900',
    color: COLORS.espresso,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.brown,
    fontWeight: '700',
    marginTop: 1,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.espresso,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.brown,
    textAlign: 'center',
  },
  mapContainer: {
    flex: 1,
  },
  mapCanvas: {
    flex: 1,
    borderRadius: RADII.lg,
    borderWidth: 2,
    borderColor: COLORS.peach,
    overflow: 'hidden',
  },
  mapPreviewCard: {
    ...CLAY_CARD_STYLE,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    marginTop: 12,
  },
  mapPreviewThumb: {
    width: 68,
    height: 68,
    borderRadius: 16,
  },
  approxPrivacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  approxPrivacyText: {
    fontSize: 11,
    color: COLORS.brown,
    fontWeight: '600',
  },
  mapViewAdBtn: {
    backgroundColor: COLORS.terracotta,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADII.pill,
  },
  mapViewAdBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
  },
});
