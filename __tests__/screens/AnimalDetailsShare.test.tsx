import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';
import { AnimalDetailsScreen } from '../../src/adapters/screens/AnimalDetailsScreen';
import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { Animal } from '../../src/domain/entities/Animal';
import { AnimalCharacteristics } from '../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../src/domain/value-objects/ApproximateLocation';

describe('AnimalDetailsScreen — Compartilhar anúncio (melhoria #6)', () => {
  const dummyLoc = new ApproximateLocation({
    latitude: -21.55,
    longitude: -45.43,
    neighborhood: 'Centro',
    city: 'Varginha',
    region: 'MG',
  });
  const dummyChar = new AnimalCharacteristics({
    species: 'Cão',
    size: 'Médio',
    approximateAge: '2 anos',
    sex: 'Fêmea',
  });

  it('abre o Share nativo com resumo do anúncio e nome do app (sem URL inventada)', async () => {
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);

    const animal = new Animal({ id: 'a1', ownerId: 'usr_owner', name: 'Rex', characteristics: dummyChar, location: dummyLoc });
    const { getByTestId, queryByText } = await render(
      <AnimalDetailsScreen
        animal={animal}
        currentUserId="usr_outro"
        animalRepository={new AnimalRepositoryFake([animal])}
      />
    );

    await fireEvent.press(getByTestId('share-animal-button'));

    expect(shareSpy).toHaveBeenCalledTimes(1);
    const call = shareSpy.mock.calls[0][0];
    expect(call.title).toBe('Enlace — Rex');
    expect(call.message).toContain('Rex');
    expect(call.message).toContain('Disponível para adoção!');
    expect(call.message).toContain('Cão');
    expect(call.message).toContain('Enlace');
    // Texto é o único canal — sem deep link inventado (spec nextsteps §4).
    expect(String(call.message)).not.toContain('http');
    // Compartilhar não gera banner de feedback em sucesso.
    expect(queryByText('Não foi possível compartilhar agora.')).toBeNull();
  });

  it('exibe feedback quando o Share falha (ex.: sem activity no emulador)', async () => {
    jest.spyOn(Share, 'share').mockRejectedValue(new Error('sem activity'));

    const animal = new Animal({ id: 'a1', ownerId: 'usr_owner', name: 'Tobi', characteristics: dummyChar, location: dummyLoc });
    const { getByTestId, getByText } = await render(
      <AnimalDetailsScreen
        animal={animal}
        currentUserId="usr_outro"
        animalRepository={new AnimalRepositoryFake([animal])}
      />
    );

    await fireEvent.press(getByTestId('share-animal-button'));
    await waitFor(() => {
      expect(getByText('sem activity')).toBeTruthy();
    });
  });
});
