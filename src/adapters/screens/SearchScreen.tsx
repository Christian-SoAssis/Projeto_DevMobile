import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';
import { Animal } from '../../domain/entities/Animal';
import { AnimalFilterOptions, AnimalRepository } from '../../domain/ports/AnimalRepository';
import { LocationGateway } from '../../domain/ports/LocationGateway';
import { AnimalMap } from '../map/AnimalMap';
import { SearchAnimalsUseCase } from '../../application/use-cases/SearchAnimalsUseCase';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { getActiveUserId } from '../sync/activeSession';
import { onPullCompleted } from '../sync/pullEvents';
import { ListSkeleton } from '../components/ListSkeleton';

export interface SearchScreenProps {
  animalRepository: AnimalRepository;
  /** DAT-10: com a fila, rascunhos (CREATE pendente) de outra conta não aparecem. */
  syncQueueRepository?: SyncQueueRepository;
  /** RF04: GPS do aparelho (solicitado sob ação do usuário) fornece a origem do raio. */
  locationGateway?: LocationGateway;
  onSelectAnimal?: (animal: Animal) => void;
  isOnlineInitial?: boolean;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({
  animalRepository,
  syncQueueRepository,
  locationGateway,
  onSelectAnimal,
  isOnlineInitial = true,
}) => {
  const [query, setQuery] = useState('');
  const [selectedSpecies, setSelectedSpecies] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedSex, setSelectedSex] = useState<string>('');
  const [ageQuery, setAgeQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(!isOnlineInitial);
  /**
   * RF04 (distância): raio escolhido pelo usuário (0 = "Sem raio", nenhum
   * filtro) e a origem aproximada capturada sob ação dele. A permissão
   * negada/erro de GPS desliga o filtro e avisa (UC01-A3: pesquisar por
   * outra região) — nunca quebra a busca.
   */
  const [radiusKm, setRadiusKm] = useState(0);
  const [origin, setOrigin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [radiusFeedback, setRadiusFeedback] = useState<string | null>(null);
  /**
   * OFF-02 (ordem 4, checklist T28): quando o pull do servidor completa,
   * o cache local muda — a tela refaz a última consulta com os dados
   * novos. O pulso é um contador: o `useEffect` abaixo relê sempre a
   * `performSearch` fresca do render, sem stale closure das dep de texto.
   */
  const [syncPulse, setSyncPulse] = useState(0);
  /**
   * Pull-to-refresh (melhoria #9): o próprio usuário dispara a nova consulta
   * puxando a lista — `refreshing` controla o indicador nativo do RefreshControl.
   */
  const [refreshing, setRefreshing] = useState(false);

  const performSearch = async (onlineOverride?: boolean) => {
    setLoading(true);
    try {
      const filters: AnimalFilterOptions = {
        searchQuery: query,
        species: selectedSpecies || undefined,
        size: selectedSize || undefined,
        sex: selectedSex || undefined,
        approximateAge: ageQuery || undefined,
        // RF04: distância só entra com raio ativo (> 0) E origem capturada.
        radiusKm: radiusKm > 0 ? radiusKm : undefined,
        origin: radiusKm > 0 && origin ? origin : undefined,
      };
      const useCase = new SearchAnimalsUseCase(
        animalRepository,
        syncQueueRepository ? { syncQueueRepository, currentUserId: getActiveUserId } : undefined
      );
      const res = await useCase.execute(
        filters,
        onlineOverride !== undefined ? onlineOverride : !isOffline
      );
      setAnimals(res.animals);
      setIsOffline(res.isOffline);
    } catch {
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => onPullCompleted(() => setSyncPulse((p) => p + 1)), []);

  /** RF04: escolha do raio pede a posição atual (ação explícita do usuário). */
  const handleSelectRadius = async (km: number) => {
    setRadiusFeedback(null);
    if (km <= 0) {
      setRadiusKm(0);
      setOrigin(null);
      return; // "Sem raio": filtro desligado, sem pedir o GPS
    }
    try {
      if (!locationGateway) {
        throw Object.assign(new Error('Localização indisponível neste ambiente.'), {
          name: 'LocationUnavailableError',
        });
      }
      const loc = await locationGateway.getCurrentLocation();
      setOrigin({ latitude: loc.latitude, longitude: loc.longitude });
      setRadiusKm(km);
    } catch (err: any) {
      // UC01-A3: sem posição atual, o filtro de distância fica de fora —
      // o usuário pesquisa por outra região (texto) e todo o resto segue.
      setOrigin(null);
      setRadiusKm(0);
      setRadiusFeedback(
        err?.name === 'LocationPermissionDeniedError' || err?.name === 'LocationUnavailableError'
          ? 'Busca por distância indisponível — pesquise por outra região.'
          : `Não foi possível obter sua localização. ${err?.message || 'Tente novamente.'}`
      );
    }
  };

  useEffect(() => {
    performSearch(isOnlineInitial);
    // Refaz a busca também quando a conectividade muda (Fase 2: NetInfo real)
    // e quando o pull de sincronização traz anúncios novos (ordem 4).
  }, [selectedSpecies, selectedSize, selectedSex, radiusKm, isOnlineInitial, syncPulse]);

  /** Pull-to-refresh: relê com os filtros atuais, sempre tentando online. */
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await performSearch();
    } finally {
      setRefreshing(false);
    }
  };

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
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => performSearch()}
          testID="search-button"
        >
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

      {/* Size Filter Pills (RF04) */}
      <View style={styles.filterRow}>
        {['Todos', 'Pequeno', 'Médio', 'Grande'].map((sz) => {
          const active = (sz === 'Todos' && !selectedSize) || selectedSize === sz;
          return (
            <TouchableOpacity
              key={sz}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSelectedSize(sz === 'Todos' ? '' : sz)}
              testID={`filter-size-${sz}`}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{sz}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Sex Filter Pills (RF04) */}
      <View style={styles.filterRow}>
        {['Todos', 'Macho', 'Fêmea'].map((sx) => {
          const active = (sx === 'Todos' && !selectedSex) || selectedSex === sx;
          return (
            <TouchableOpacity
              key={sx}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSelectedSex(sx === 'Todos' ? '' : sx)}
              testID={`filter-sex-${sx}`}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{sx}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Age Filter (RF04, mock contains) */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Filtrar por idade aproximada..."
          value={ageQuery}
          onChangeText={setAgeQuery}
          testID="search-age-input"
        />
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => performSearch()}
          testID="search-age-button"
        >
          <Text style={styles.buttonText}>Filtrar</Text>
        </TouchableOpacity>
      </View>

      {/* Distance Filter Pills (RF04) */}
      <View style={styles.filterRow}>
        {(['Sem raio', '1 km', '3 km', '5 km', '10 km'] as const).map((label) => {
          const km = label === 'Sem raio' ? 0 : Number(label.split(' ')[0]);
          const active = km === 0 ? radiusKm === 0 : radiusKm === km;
          return (
            <TouchableOpacity
              key={label}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => handleSelectRadius(km)}
              testID={`filter-radius-${km}`}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {radiusFeedback && (
        <Text style={styles.radiusFeedback} testID="radius-feedback">
          {radiusFeedback}
        </Text>
      )}

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

      {/* Skeleton no carregamento SEM dados (melhoria #9): linhas pulsantes
          em vez do spinner. Com dados na tela, a lista PERMANECE visível
          durante a recarga — o feedback vem do RefreshControl (pull) ou do
          banner. */}
      {loading && animals.length === 0 ? (
        <ListSkeleton rows={3} />
      ) : viewMode === 'map' ? (
        <AnimalMap animals={animals} onSelectAnimal={onSelectAnimal} />
      ) : (
        <FlatList
          data={animals}
          keyExtractor={(item) => item.id}
          testID="animals-list"
          refreshing={refreshing}
          onRefresh={handleRefresh}
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
  radiusFeedback: {
    marginBottom: 12,
    marginTop: -8,
    color: '#8a1c1c',
    fontSize: 12,
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
  emptyText: {
    textAlign: 'center',
    marginTop: 24,
    color: '#8e8e93',
  },
});
