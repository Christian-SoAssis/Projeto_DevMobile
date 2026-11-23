import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
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
import { SearchPreferences } from '../../src/domain/entities/SearchPreferences';
import { SearchAnimalsUseCase } from '../../src/application/use-cases/SearchAnimalsUseCase';
import { ToggleFavoriteUseCase } from '../../src/application/use-cases/ToggleFavoriteUseCase';
import { useRepositories } from '../../src/adapters/context/RepositoriesContext';
import { useAuth } from '../../src/adapters/context/AuthContext';
import { useConnectivity } from '../../src/adapters/hooks/useConnectivity';
import { useFullSync } from '../../src/adapters/hooks/useFullSync';
import { subscribePullCompleted } from '../../src/adapters/sync/pullEvents';
import { EnlaceHeader } from '../../src/adapters/components/EnlaceHeader';
import {
  CLAY_CARD_STYLE,
  CLAY_INSET_INPUT_STYLE,
  CLAY_PRIMARY_BUTTON_STYLE,
  CLAY_SECONDARY_BUTTON_STYLE,
  COLORS,
  RADII,
} from '../../src/adapters/theme/tokens';

const FALLBACK_PHOTO = 'https://images.unsplash.com/photo-1543466835-00a7907e9de1';

/**
 * V03 • Explorar: Lista | V04 • Explorar: Mapa | V05 • Filtros da busca
 */
export default function HomeScreen() {
  const router = useRouter();
  const container = useRepositories();
  const { user } = useAuth();
  const isOnline = useConnectivity();

  const [viewMode, setViewMode] = useState<'LIST' | 'MAP'>('LIST');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickSpecies, setQuickSpecies] = useState<'Todos' | 'Cão' | 'Gato'>('Todos');
  const [filterModalOpen, setFilterModalOpen] = useState(false);

  const [filterSpecies, setFilterSpecies] = useState<string>('Todos');
  const [filterSize, setFilterSize] = useState<string>('Todos');
  const [filterSex, setFilterSex] = useState<string>('Todos');
  const [filterAge, setFilterAge] = useState<string>('');
  const [filterDistanceKm, setFilterDistanceKm] = useState<number | undefined>(undefined);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number }>({
    latitude: -21.55,
    longitude: -45.43,
  });

  const [animals, setAnimals] = useState<Animal[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [selectedMapAnimal, setSelectedMapAnimal] = useState<Animal | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const runFullSync = useFullSync();

  useEffect(() => {
    let active = true;
    async function restorePreferences() {
      try {
        const saved = await container.searchPreferencesRepository.get();
        if (!saved || !active) return;
        if (saved.species) {
          setFilterSpecies(saved.species);
          if (saved.species === 'Cão' || saved.species === 'Gato') {
            setQuickSpecies(saved.species);
          }
        }
        if (saved.size) setFilterSize(saved.size);
        if (saved.sex) setFilterSex(saved.sex);
        if (saved.approximateAge) setFilterAge(saved.approximateAge);
        if (saved.radius) setFilterDistanceKm(saved.radius.km);
      } catch {
        // mantém filtros padrão
      }
    }
    void restorePreferences();
    return () => {
      active = false;
    };
  }, [container]);

  useEffect(() => {
    if (filterDistanceKm === undefined) return;
    let active = true;
    container.locationGateway
      .getCurrentLocation()
      .then((loc) => {
        if (active) {
          setUserCoords({ latitude: loc.latitude, longitude: loc.longitude });
        }
      })
      .catch(() => {
        // mantém fallback de Varginha (-21.55, -45.43) se o GPS estiver indisponível
      });
    return () => {
      active = false;
    };
  }, [filterDistanceKm, container]);

  const searchUseCase = useMemo(
    () => new SearchAnimalsUseCase(container.animalRepository, container.syncQueueRepository),
    [container]
  );

  const toggleFavoriteUseCase = useMemo(
    () =>
      new ToggleFavoriteUseCase(
        container.favoriteRepository,
        container.syncQueueRepository,
        container.remoteFavorites
      ),
    [container]
  );

  const loadData = useCallback(async () => {
    const activeSpecies = quickSpecies !== 'Todos' ? quickSpecies : filterSpecies;
    const list = await searchUseCase.execute({
      query: searchQuery,
      species: activeSpecies === 'Todos' ? undefined : activeSpecies,
      size: filterSize === 'Todos' ? undefined : filterSize,
      sex: filterSex === 'Todos' ? undefined : filterSex,
      approximateAge: filterAge || undefined,
      maxDistanceKm: filterDistanceKm,
      latitude: filterDistanceKm !== undefined ? userCoords.latitude : undefined,
      longitude: filterDistanceKm !== undefined ? userCoords.longitude : undefined,
      currentUserId: user?.id ?? null,
    });
    setAnimals(list);
    setSelectedMapAnimal((prev) =>
      prev && list.some((a) => a.id === prev.id) ? prev : list[0] ?? null
    );

    if (user) {
      const favs = await container.favoriteRepository.listByUser(user.id);
      setFavoriteIds(new Set(favs.map((f) => f.animalId)));
    } else {
      setFavoriteIds(new Set());
    }
  }, [
    container,
    searchUseCase,
    searchQuery,
    quickSpecies,
    filterSpecies,
    filterSize,
    filterSex,
    filterAge,
    filterDistanceKm,
    userCoords,
    user,
  ]);

  useEffect(() => {
    loadData();
    const unsub = subscribePullCompleted(loadData);
    return unsub;
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // 1. Recarrega os dados locais imediatamente a partir do SQLite (resposta instantânea)
      const localReload = loadData();

      // 2. Se online, inicia a sincronização e aguarda no máximo 800ms para liberar a UI
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

  const applyFilterModal = async () => {
    try {
      await container.searchPreferencesRepository.save(
        new SearchPreferences({
          species: filterSpecies === 'Todos' ? undefined : filterSpecies,
          size: filterSize === 'Todos' ? undefined : filterSize,
          sex: filterSex === 'Todos' ? undefined : filterSex,
          approximateAge: filterAge || undefined,
          distanceKm: filterDistanceKm,
        })
      );
    } catch {
      // ignora erro de validação
    }
    if (filterSpecies === 'Cão' || filterSpecies === 'Gato' || filterSpecies === 'Todos') {
      setQuickSpecies(filterSpecies);
    }
    setFilterModalOpen(false);
    loadData();
  };

  const clearFilters = async () => {
    setFilterSpecies('Todos');
    setFilterSize('Todos');
    setFilterSex('Todos');
    setFilterAge('');
    setFilterDistanceKm(undefined);
    setQuickSpecies('Todos');
    await container.searchPreferencesRepository.clear();
    setFilterModalOpen(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <EnlaceHeader onLocationPress={() => setFilterModalOpen(true)} />

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
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={COLORS.brownMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Abrir filtros da busca"
            onPress={() => setFilterModalOpen(true)}
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
                const active = quickSpecies === chip.value;
                return (
                  <TouchableOpacity
                    key={chip.value}
                    accessibilityRole="button"
                    onPress={() => {
                      setQuickSpecies(chip.value);
                      setFilterSpecies(chip.value);
                    }}
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
          renderItem={({ item }) => {
            const photoUri = item.photos[0]?.displayUri || FALLBACK_PHOTO;
            const isFav = favoriteIds.has(item.id);
            return (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => router.push(`/animal/${item.id}`)}
                style={styles.animalCard}
              >
                <Image source={{ uri: photoUri }} style={styles.animalThumb} />
                <View style={styles.animalInfo}>
                  <View style={styles.animalHeaderRow}>
                    <Text style={styles.animalName}>{item.name}</Text>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Favoritar anúncio"
                      onPress={() => handleToggleFavorite(item.id)}
                      style={styles.heartBtn}
                    >
                      <Ionicons
                        name={isFav ? 'heart' : 'heart-outline'}
                        size={20}
                        color={COLORS.terracotta}
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.badgeAvailable}>
                    <Text style={styles.badgeAvailableText}>
                      {item.status.isAvailable() ? 'Disponível' : 'Adotado'}
                    </Text>
                  </View>

                  <Text style={styles.metaText}>
                    🐾 {item.characteristics.approximateAge} • {item.characteristics.sex}
                  </Text>
                  <Text style={styles.metaText}>🐾 {item.characteristics.size}</Text>
                  <Text style={styles.locationMetaText}>
                    📍 {item.location.displayLabel}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
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
                  uri: selectedMapAnimal.photos[0]?.displayUri || FALLBACK_PHOTO,
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

      {/* V05 • Filtros da busca */}
      <Modal
        visible={filterModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeaderRow}>
              <Text style={styles.sheetTitle}>Encontre seu{'\n'}companheiro</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Fechar filtros"
                onPress={() => setFilterModalOpen(false)}
              >
                <Ionicons name="close" size={24} color={COLORS.espresso} />
              </TouchableOpacity>
            </View>

            <Text style={styles.filterGroupLabel}>Espécie</Text>
            <View style={styles.filterOptionRow}>
              {(
                [
                  { label: 'Todos', val: 'Todos' },
                  { label: 'Cães', val: 'Cão' },
                  { label: 'Gatos', val: 'Gato' },
                ] as const
              ).map((opt) => (
                <TouchableOpacity
                  key={opt.val}
                  onPress={() => setFilterSpecies(opt.val)}
                  style={[
                    styles.filterOptionPill,
                    filterSpecies === opt.val && styles.filterOptionPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      filterSpecies === opt.val && styles.filterOptionTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterGroupLabel}>Porte</Text>
            <View style={styles.filterOptionRow}>
              {(['Todos', 'Pequeno', 'Médio', 'Grande'] as const).map((sz) => (
                <TouchableOpacity
                  key={sz}
                  onPress={() => setFilterSize(sz)}
                  style={[
                    styles.filterOptionPill,
                    filterSize === sz && styles.filterOptionPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      filterSize === sz && styles.filterOptionTextActive,
                    ]}
                  >
                    {sz}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterGroupLabel}>Sexo</Text>
            <View style={styles.filterOptionRow}>
              {(['Todos', 'Macho', 'Fêmea'] as const).map((sx) => (
                <TouchableOpacity
                  key={sx}
                  onPress={() => setFilterSex(sx)}
                  style={[
                    styles.filterOptionPill,
                    filterSex === sx && styles.filterOptionPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      filterSex === sx && styles.filterOptionTextActive,
                    ]}
                  >
                    {sx}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterGroupLabel}>Idade aproximada</Text>
            <View style={styles.ageInputRow}>
              <Ionicons name="calendar-outline" size={18} color={COLORS.brown} />
              <TextInput
                style={styles.searchInput}
                placeholder="Ex.: 2 anos"
                placeholderTextColor={COLORS.brownMuted}
                value={filterAge}
                onChangeText={setFilterAge}
              />
            </View>

            <Text style={styles.filterGroupLabel}>Distância máxima (RF04 — máx. 10 km)</Text>
            <View style={styles.filterOptionRow}>
              {[
                { label: 'Qualquer', km: undefined },
                { label: 'Até 5 km', km: 5 },
                { label: 'Até 10 km', km: 10 },
              ].map((d) => (
                <TouchableOpacity
                  key={d.label}
                  onPress={() => setFilterDistanceKm(d.km)}
                  style={[
                    styles.filterOptionPill,
                    filterDistanceKm === d.km && styles.filterOptionPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      filterDistanceKm === d.km && styles.filterOptionTextActive,
                    ]}
                  >
                    {d.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.sheetActionsRow}>
              <TouchableOpacity
                onPress={clearFilters}
                style={[CLAY_SECONDARY_BUTTON_STYLE, { flex: 1 }]}
              >
                <Text style={styles.clearBtnText}>Limpar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={applyFilterModal}
                style={[CLAY_PRIMARY_BUTTON_STYLE, { flex: 1.4 }]}
              >
                <Text style={styles.applyBtnText}>Aplicar filtros</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  animalCard: {
    ...CLAY_CARD_STYLE,
    flexDirection: 'row',
    padding: 12,
    gap: 12,
    alignItems: 'center',
  },
  animalThumb: {
    width: 106,
    height: 106,
    borderRadius: 18,
    backgroundColor: COLORS.peach,
  },
  animalInfo: {
    flex: 1,
  },
  animalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  animalName: {
    fontSize: 19,
    fontWeight: '900',
    color: COLORS.espresso,
  },
  heartBtn: {
    padding: 4,
  },
  badgeAvailable: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.green,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADII.pill,
    marginVertical: 4,
  },
  badgeAvailableText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
  },
  metaText: {
    fontSize: 12,
    color: COLORS.brown,
    fontWeight: '700',
    marginTop: 1,
  },
  locationMetaText: {
    fontSize: 12,
    color: COLORS.espresso,
    fontWeight: '800',
    marginTop: 2,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(58, 31, 20, 0.48)',
    justifyContent: 'flex-end',
  },
  filterSheet: {
    backgroundColor: COLORS.ivory,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 2,
    borderColor: COLORS.peach,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.peach,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.espresso,
  },
  filterGroupLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.espresso,
    marginTop: 10,
    marginBottom: 6,
  },
  filterOptionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOptionPill: {
    backgroundColor: COLORS.cream,
    borderRadius: RADII.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: COLORS.peach,
  },
  filterOptionPillActive: {
    backgroundColor: COLORS.terracotta,
    borderColor: COLORS.terracottaDark,
  },
  filterOptionText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.espresso,
  },
  filterOptionTextActive: {
    color: COLORS.white,
  },
  ageInputRow: {
    ...CLAY_INSET_INPUT_STYLE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
  },
  sheetActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  clearBtnText: {
    color: COLORS.espresso,
    fontWeight: '800',
    fontSize: 15,
  },
  applyBtnText: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 15,
  },
});
