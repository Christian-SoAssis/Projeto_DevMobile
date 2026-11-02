import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { makeAnimal, makeLocation } from '../../test-support/fixtures';

const mockMapView = jest.fn();
jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  const MapView = (props: any) => {
    mockMapView(props);
    return <View testID={props.testID}>{props.children}</View>;
  };
  const Marker = (props: any) => <View testID={props.testID} {...props} />;
  const Circle = (props: any) => <View testID="map-circle" {...props} />;
  return { __esModule: true, default: MapView, Marker, Circle };
});

import { AnimalMap } from '../../src/adapters/map/AnimalMap';

describe('AnimalMap (módulo de mapa disponível)', () => {
  const animals = [
    makeAnimal({ id: 'a', name: 'Luna', location: makeLocation({ latitude: -21.554, longitude: -45.43 }) }),
    makeAnimal({ id: 'b', name: 'Thor', location: makeLocation({ latitude: -21.6, longitude: -45.5, neighborhood: 'Vila' }) }),
  ];

  beforeEach(() => mockMapView.mockClear());

  it('renderiza um marcador e um círculo de área aproximada por anúncio, com aviso de privacidade', async () => {
    const { getByTestId, getAllByTestId } = await render(<AnimalMap animals={animals} />);
    expect(getByTestId('map-view')).toBeTruthy();
    expect(getByTestId('map-pin-a').props.coordinate).toEqual({ latitude: -21.55, longitude: -45.43 });
    expect(getByTestId('map-pin-b').props.title).toBe('Thor');
    expect(getAllByTestId('map-circle')).toHaveLength(2);
    expect(getByTestId('map-privacy-note')).toBeTruthy();
    expect(mockMapView.mock.calls[0][0].initialRegion.latitudeDelta).toBeGreaterThan(0.05);
  });

  it('tocar no balão do marcador abre o anúncio', async () => {
    const onSelect = jest.fn();
    const { getByTestId } = await render(<AnimalMap animals={animals} onSelectAnimal={onSelect} />);
    await fireEvent(getByTestId('map-pin-b'), 'calloutPress');
    expect(onSelect).toHaveBeenCalledWith(animals[1]);
  });
});
