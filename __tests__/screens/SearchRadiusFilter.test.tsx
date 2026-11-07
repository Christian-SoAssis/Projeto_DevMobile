import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SearchScreen } from '../../src/adapters/screens/SearchScreen';
import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { makeAnimal, makeLocation } from '../../test-support/fixtures';
import {
  LocationPermissionDeniedError,
  LocationUnavailableError,
} from '../../src/infrastructure/device/location/LocationAdapter';

/**
 * RF04 (distância, decisão §4 — máx. 10 km): a tela de busca oferece o
 * filtro por raio; a ORIGEM é a posição do aparelho, solicitada apenas
 * sob ação do usuário (§0.5/RF24, mesmo contrato do formulário). UC01-A3:
 * permissão negada / GPS indisponível NÃO quebra a busca — o filtro de
 * distância fica de fora e a mensagem aponta a pesquisa por outra região.
 */
const ORIGIN = { latitude: -21.554, longitude: -45.43 };

function makeAnimalAt(id: string, name: string, latitude: number) {
  return makeAnimal({
    id,
    name,
    location: makeLocation({ latitude, longitude: -45.43 }),
  });
}

function grantedGateway() {
  return {
    getCurrentLocation: jest.fn(async () => makeLocation({ latitude: -21.554 })),
  };
}

function deniedGateway(kind: 'LocationPermissionDeniedError' | 'LocationUnavailableError') {
  return {
    getCurrentLocation: jest.fn(async () => {
      throw kind === 'LocationPermissionDeniedError'
        ? new LocationPermissionDeniedError()
        : new LocationUnavailableError();
    }),
  };
}

describe('SearchScreen — filtro por distância (RF04)', () => {
  it('raio de 5 km mantém só os anúncios dentro da distância da origem', async () => {
    // Luna a ~1,1 km da origem; Thor a ~55 km.
    const animalRepository = new AnimalRepositoryFake([
      makeAnimalAt('perto', 'Luna', -21.564),
      makeAnimalAt('longe', 'Thor', -21.054),
    ]);
    const { getByTestId, queryByTestId } =
      await render(<SearchScreen animalRepository={animalRepository} locationGateway={grantedGateway() as any} />);

    await waitFor(() => expect(queryByTestId('animal-card-perto')).toBeTruthy());
    fireEvent.press(getByTestId('filter-radius-5'));

    await waitFor(() => expect(queryByTestId('animal-card-perto')).toBeTruthy());
    expect(queryByTestId('animal-card-longe')).toBeNull();
    expect(queryByTestId('radius-feedback')).toBeNull();
  });

  it('"Sem raio" restaura todos os anúncios (sem filtro de distância)', async () => {
    const animalRepository = new AnimalRepositoryFake([
      makeAnimalAt('perto', 'Luna', -21.564),
      makeAnimalAt('longe', 'Thor', -21.054),
    ]);
    const { getByTestId, queryByTestId } = await render(
      <SearchScreen animalRepository={animalRepository} locationGateway={grantedGateway() as any} />
    );

    await waitFor(() => expect(queryByTestId('animal-card-perto')).toBeTruthy());
    fireEvent.press(getByTestId('filter-radius-5'));
    await waitFor(() => expect(queryByTestId('animal-card-longe')).toBeNull());

    fireEvent.press(getByTestId('filter-radius-0'));
    await waitFor(() => expect(queryByTestId('animal-card-longe')).toBeTruthy());
    expect(queryByTestId('animal-card-perto')).toBeTruthy();
  });

  it('permissão negada não quebra a busca (UC01-A3): mensagem visível e filtros restantes intactos', async () => {
    const animalRepository = new AnimalRepositoryFake([
      makeAnimalAt('perto', 'Luna', -21.564),
      makeAnimalAt('longe', 'Thor', -21.054),
    ]);
    const { getByTestId, queryByTestId } = await render(
      <SearchScreen
        animalRepository={animalRepository}
        locationGateway={deniedGateway('LocationPermissionDeniedError') as any}
      />
    );

    await waitFor(() => expect(queryByTestId('animal-card-perto')).toBeTruthy());
    fireEvent.press(getByTestId('filter-radius-5'));

    await waitFor(() => expect(getByTestId('radius-feedback').props.children).toContain('pesquise por outra região'));
    await waitFor(() => expect(queryByTestId('animal-card-perto')).toBeTruthy());
    expect(queryByTestId('animal-card-longe')).toBeTruthy(); // nenhum anúncio sumiu
  });

  it('sem gateway de localização (demo/visitante) o filtro degrada com aviso, sem quebrar', async () => {
    const animalRepository = new AnimalRepositoryFake([
      makeAnimalAt('perto', 'Luna', -21.564),
      makeAnimalAt('longe', 'Thor', -21.054),
    ]);
    const { getByTestId, queryByTestId } = await render(
      <SearchScreen animalRepository={animalRepository} />
    );

    await waitFor(() => expect(queryByTestId('animal-card-perto')).toBeTruthy());
    fireEvent.press(getByTestId('filter-radius-10'));

    await waitFor(() => expect(getByTestId('radius-feedback').props.children).toContain('pesquise por outra região'));
    await waitFor(() => expect(queryByTestId('animal-card-perto')).toBeTruthy());
    expect(queryByTestId('animal-card-longe')).toBeTruthy();
  });
});
