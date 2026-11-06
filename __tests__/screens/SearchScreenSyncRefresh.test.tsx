import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { SearchScreen } from '../../src/adapters/screens/SearchScreen';
import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { notifyPullCompleted } from '../../src/adapters/sync/pullEvents';
import { Animal } from '../../src/domain/entities/Animal';
import { AnimalCharacteristics } from '../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../src/domain/value-objects/ApproximateLocation';

/**
 * OFF-02 (ordem 4 — re-consulta de listas após pull, checklist T28): a tela
 * de busca fica aberta quando o pull do servidor completa; o usuário não
 * pode precisar sair e voltar para ver o anúncio criado por outra pessoa.
 * A tela observa o evento de adapters (`notifyPullCompleted`) e refaz a
 * última consulta.
 */

function makeAnimal(id: string, name: string): Animal {
  return new Animal({
    id,
    ownerId: 'usr_1',
    name,
    characteristics: new AnimalCharacteristics({
      species: 'Cão',
      size: 'Pequeno',
      approximateAge: '2 anos',
      sex: 'Fêmea',
    }),
    location: new ApproximateLocation({
      latitude: -21.55,
      longitude: -45.44,
      neighborhood: 'Centro',
      city: 'Varginha',
      region: 'MG',
    }),
  });
}

describe('SearchScreen — re-consulta após pull concluído (T28)', () => {
  it('anúncio trazido pelo pull aparece na lista aberta, sem sair da tela', async () => {
    const animalRepository = new AnimalRepositoryFake([makeAnimal('a1', 'Luna')]);
    const { queryByTestId, getByTestId } = await render(
      <SearchScreen animalRepository={animalRepository} isOnlineInitial />
    );

    await waitFor(() => expect(getByTestId('animal-card-a1')).toBeTruthy());
    expect(queryByTestId('animal-card-a2')).toBeNull();

    // "Pull" chega: o cache local passa a ter o anúncio de outra pessoa.
    await act(async () => {
      animalRepository.items.set('a2', makeAnimal('a2', 'Bob'));
      notifyPullCompleted();
    });

    await waitFor(() => expect(getByTestId('animal-card-a2')).toBeTruthy());
    expect(queryByTestId('animal-card-a1')).toBeTruthy(); // o anterior permanece
  });
});
