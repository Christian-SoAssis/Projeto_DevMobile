import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Animal } from '../../domain/entities/Animal';
import { markerForAnimal, regionForMarkers } from './mapRegion';

export interface AnimalMapProps {
  animals: Animal[];
  onSelectAnimal?: (animal: Animal) => void;
}

interface MapsModule {
  MapView: React.ComponentType<any>;
  Marker: React.ComponentType<any>;
  Circle: React.ComponentType<any>;
}

/**
 * Carrega `react-native-maps` só quando disponível. Na web, no Jest ou sem a
 * ponte nativa, devolve `null` e o mapa cai na lista de pinos em texto — o
 * app nunca quebra por falta do módulo (mesmo padrão dos outros adapters).
 */
function loadMaps(): MapsModule | null {
  if (Platform.OS === 'web') return null;
  try {
    const mod = require('react-native-maps');
    const MapView = mod.default ?? mod.MapView;
    if (!MapView || !mod.Marker) return null;
    return { MapView, Marker: mod.Marker, Circle: mod.Circle };
  } catch {
    return null;
  }
}

/** Raio do círculo que representa a área aproximada (nunca um ponto exato). */
const APPROX_RADIUS_M = 600;

export const AnimalMap: React.FC<AnimalMapProps> = ({ animals, onSelectAnimal }) => {
  const markers = useMemo(() => animals.map(markerForAnimal), [animals]);
  const region = useMemo(() => regionForMarkers(markers), [markers]);
  const maps = useMemo(loadMaps, []);
  const byId = useMemo(() => new Map(animals.map((a) => [a.id, a])), [animals]);

  const note = (
    <Text style={styles.note} testID="map-privacy-note">
      Localizações aproximadas: o endereço exato nunca é exibido.
    </Text>
  );

  if (!maps) {
    return (
      <View style={styles.fallback} testID="map-view">
        <Text style={styles.title}>Visualização em Mapa (Localizações Aproximadas)</Text>
        {markers.map((m) => (
          <Text key={m.id} style={styles.pinText} testID={`map-pin-${m.id}`}>
            📍 {m.title} ({m.description})
          </Text>
        ))}
        {markers.length === 0 && <Text style={styles.empty}>Nenhum anúncio para mostrar no mapa.</Text>}
      </View>
    );
  }

  const { MapView, Marker, Circle } = maps;
  return (
    <View style={styles.container} testID="map-view">
      <MapView
        key={markers.map((m) => m.id).join('|')}
        style={styles.map}
        initialRegion={region}
        testID="native-map"
      >
        {markers.map((m) => (
          <React.Fragment key={m.id}>
            {Circle && (
              <Circle
                center={{ latitude: m.latitude, longitude: m.longitude }}
                radius={APPROX_RADIUS_M}
                strokeColor="rgba(0,102,204,0.6)"
                fillColor="rgba(0,102,204,0.15)"
              />
            )}
            <Marker
              coordinate={{ latitude: m.latitude, longitude: m.longitude }}
              title={m.title}
              description={m.description}
              onCalloutPress={() => {
                const animal = byId.get(m.id);
                if (animal) onSelectAnimal?.(animal);
              }}
              testID={`map-pin-${m.id}`}
            />
          </React.Fragment>
        ))}
      </MapView>
      {note}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  note: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    color: '#48484a',
    fontSize: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  fallback: { flex: 1, padding: 16, backgroundColor: '#fff' },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  pinText: { fontSize: 14, marginVertical: 4, color: '#333' },
  empty: { color: '#8e8e93', marginTop: 12 },
});
