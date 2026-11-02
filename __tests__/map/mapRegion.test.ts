import { DEFAULT_REGION, markerForAnimal, regionForMarkers } from '../../src/adapters/map/mapRegion';
import { makeAnimal, makeLocation } from '../../test-support/fixtures';

describe('mapRegion (RF05/RF25)', () => {
  it('marcador usa SEMPRE a coordenada aproximada, nunca a exata', () => {
    const animal = makeAnimal({ location: makeLocation({ latitude: -21.55432, longitude: -45.43987 }) });
    const marker = markerForAnimal(animal);
    expect(marker.latitude).toBe(-21.55);
    expect(marker.longitude).toBe(-45.44);
    expect(marker.latitude).not.toBe(animal.location.latitude);
    expect(marker.description).toBe('Centro, Varginha');
    expect(marker.title).toBe('Luna');
  });

  it('sem anúncios: região padrão do Brasil', () => {
    expect(regionForMarkers([])).toBe(DEFAULT_REGION);
  });

  it('um anúncio: centraliza nele com zoom mínimo de cidade', () => {
    const region = regionForMarkers([markerForAnimal(makeAnimal())]);
    expect(region.latitude).toBe(-21.55);
    expect(region.longitude).toBe(-45.43);
    expect(region.latitudeDelta).toBeGreaterThanOrEqual(0.05);
  });

  it('vários anúncios: enquadra todos com folga', () => {
    const a = markerForAnimal(makeAnimal({ id: 'a', location: makeLocation({ latitude: -20, longitude: -45 }) }));
    const b = markerForAnimal(makeAnimal({ id: 'b', location: makeLocation({ latitude: -22, longitude: -43 }) }));
    const region = regionForMarkers([a, b]);
    expect(region.latitude).toBeCloseTo(-21);
    expect(region.longitude).toBeCloseTo(-44);
    expect(region.latitudeDelta).toBeCloseTo(2.8);
    expect(region.longitudeDelta).toBeCloseTo(2.8);
  });
});
