import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { SearchPreferences } from '../../domain/entities/SearchPreferences';
import { useRepositories } from '../context/RepositoriesContext';
import { logger } from '../logging/logger';

export type SpeciesFilterOption = 'Todos' | 'Cão' | 'Gato';

export function useSearchFilters(onApplied?: () => void) {
  const container = useRepositories();

  const [searchQuery, setSearchQuery] = useState('');
  const [species, setSpecies] = useState<SpeciesFilterOption>('Todos');
  const [size, setSize] = useState<string>('Todos');
  const [sex, setSex] = useState<string>('Todos');
  const [approximateAge, setApproximateAge] = useState<string>('');
  const [distanceKm, setDistanceKm] = useState<number | undefined>(undefined);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number }>({
    latitude: -21.55,
    longitude: -45.43,
  });

  useEffect(() => {
    let active = true;
    async function restorePreferences() {
      try {
        const saved = await container.searchPreferencesRepository.get();
        if (!saved || !active) return;
        if (saved.species === 'Cão' || saved.species === 'Gato') {
          setSpecies(saved.species);
        }
        if (saved.size) setSize(saved.size);
        if (saved.sex) setSex(saved.sex);
        if (saved.approximateAge) setApproximateAge(saved.approximateAge);
        if (saved.distanceKm !== undefined) setDistanceKm(saved.distanceKm);
      } catch (err) {
        logger.warn('useSearchFilters.restorePreferences', err);
      }
    }
    void restorePreferences();
    return () => {
      active = false;
    };
  }, [container]);

  useEffect(() => {
    if (distanceKm === undefined) return;
    let active = true;
    container.locationGateway
      .getCurrentLocation()
      .then((loc) => {
        if (active) {
          setUserCoords({ latitude: loc.latitude, longitude: loc.longitude });
        }
      })
      .catch((err) => {
        logger.warn('useSearchFilters.getCurrentLocation', err);
      });
    return () => {
      active = false;
    };
  }, [distanceKm, container]);

  const applyFilterModal = useCallback(async () => {
    try {
      await container.searchPreferencesRepository.save(
        new SearchPreferences({
          species: species === 'Todos' ? undefined : species,
          size: size === 'Todos' ? undefined : size,
          sex: sex === 'Todos' ? undefined : sex,
          approximateAge: approximateAge || undefined,
          distanceKm,
        })
      );
      setFilterModalOpen(false);
      onApplied?.();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Verifique os filtros selecionados e tente novamente.';
      Alert.alert('Filtro inválido', msg);
    }
  }, [container, species, size, sex, approximateAge, distanceKm, onApplied]);

  const clearFilters = useCallback(async () => {
    setSpecies('Todos');
    setSize('Todos');
    setSex('Todos');
    setApproximateAge('');
    setDistanceKm(undefined);
    try {
      await container.searchPreferencesRepository.clear();
    } catch (err) {
      logger.warn('useSearchFilters.clearFilters', err);
    }
    setFilterModalOpen(false);
  }, [container]);

  return {
    searchQuery,
    setSearchQuery,
    species,
    setSpecies,
    size,
    setSize,
    sex,
    setSex,
    approximateAge,
    setApproximateAge,
    distanceKm,
    setDistanceKm,
    userCoords,
    filterModalOpen,
    setFilterModalOpen,
    applyFilterModal,
    clearFilters,
  };
}
