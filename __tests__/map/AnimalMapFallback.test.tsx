import React from 'react';
import { render } from '@testing-library/react-native';
import { makeAnimal } from '../../test-support/fixtures';

jest.mock('react-native-maps', () => {
  throw new Error('módulo nativo indisponível');
});

import { AnimalMap } from '../../src/adapters/map/AnimalMap';

describe('AnimalMap (sem módulo de mapa: web/Jest/sem ponte nativa)', () => {
  it('cai na lista de pinos em texto, com coordenadas aproximadas e sem quebrar', async () => {
    const { getByTestId, getByText } = await render(<AnimalMap animals={[makeAnimal()]} />);
    expect(getByTestId('map-view')).toBeTruthy();
    expect(getByTestId('map-pin-animal_1')).toBeTruthy();
    expect(getByText(/Luna \(Centro, Varginha\)/)).toBeTruthy();
  });

  it('sem anúncios mostra estado vazio', async () => {
    const { getByText } = await render(<AnimalMap animals={[]} />);
    expect(getByText('Nenhum anúncio para mostrar no mapa.')).toBeTruthy();
  });
});
