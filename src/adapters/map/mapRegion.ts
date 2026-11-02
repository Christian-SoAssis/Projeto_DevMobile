import { Animal } from '../../domain/entities/Animal';

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface AnimalMarker {
  id: string;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
}

/** Centro do Brasil: região inicial quando não há anúncios para enquadrar. */
export const DEFAULT_REGION: MapRegion = {
  latitude: -14.235,
  longitude: -51.925,
  latitudeDelta: 30,
  longitudeDelta: 30,
};

/** Delta mínimo (~ uma cidade) para um anúncio sozinho não virar zoom de rua. */
const MIN_DELTA = 0.05;

/**
 * Marcador de um anúncio. Usa SEMPRE a coordenada aproximada (arredondada) —
 * a localização exata nunca chega ao mapa (RF25, RNF05/RNF06, §15.2).
 */
export function markerForAnimal(animal: Animal): AnimalMarker {
  const { latitudeApprox, longitudeApprox } = animal.location.getApproximateCoordinates();
  return {
    id: animal.id,
    title: animal.name,
    description: `${animal.location.neighborhood}, ${animal.location.city}`,
    latitude: latitudeApprox,
    longitude: longitudeApprox,
  };
}

/** Região que enquadra todos os marcadores, com folga nas bordas. */
export function regionForMarkers(markers: readonly AnimalMarker[]): MapRegion {
  if (markers.length === 0) return DEFAULT_REGION;
  const lats = markers.map((m) => m.latitude);
  const lngs = markers.map((m) => m.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.4, MIN_DELTA),
    longitudeDelta: Math.max((maxLng - minLng) * 1.4, MIN_DELTA),
  };
}
