import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AnimalFormScreen } from '../../src/adapters/screens/AnimalFormScreen';
import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { SyncQueueRepositoryFake } from '../../src/application/fakes/SyncQueueRepositoryFake';
import { PhotoStorageFake } from '../../src/application/fakes/PhotoStorageFake';
import { CameraGateway, CameraPhotoResult } from '../../src/domain/ports/CameraGateway';
import { makeAnimal, makeCharacteristics, makePhoto } from '../../test-support/fixtures';

/**
 * Decisão 17 (RF08 + RF09): características, comportamento e cuidados
 * especiais são campos OPCIONAIS do formulário — espécie/porte/idade/sexo
 * continuam obrigatórios. Em edição, vêm pré-preenchidos do agregado.
 */

function camera() {
  return {
    capturePhoto: async () => ({ uri: 'file:///cap/foto.jpg' } as CameraPhotoResult),
    pickImageFromGallery: async () => null,
  } as unknown as CameraGateway;
}

function renderForm(props: Partial<Parameters<typeof AnimalFormScreen>[0]> = {}) {
  return render(
    <AnimalFormScreen
      animalRepository={new AnimalRepositoryFake()}
      syncQueueRepository={new SyncQueueRepositoryFake()}
      cameraGateway={camera()}
      photoStorage={new PhotoStorageFake()}
      {...props}
    />
  );
}

describe('AnimalFormScreen — características opcionais (decisão 17)', () => {
  it('create: opcionais preenchidos chegam ao agregado salvo', async () => {
    const repository = new AnimalRepositoryFake();
    const { getByTestId } = await renderForm({ animalRepository: repository });

    await fireEvent.press(getByTestId('btn-capture-photo'));
    await fireEvent.changeText(getByTestId('input-name'), 'Luna Característica');
    await fireEvent.changeText(getByTestId('input-characteristics'), 'Dócil e brincalhona');
    await fireEvent.changeText(getByTestId('input-behavior'), 'Amiga de crianças');
    await fireEvent.changeText(getByTestId('input-special-care'), 'Medicação diária');
    await fireEvent.press(getByTestId('btn-submit-animal'));

    await waitFor(() => expect(Array.from(repository.items.values())).toHaveLength(1));
    const saved = Array.from(repository.items.values())[0];
    expect(saved.characteristics.characteristics).toBe('Dócil e brincalhona');
    expect(saved.characteristics.behavior).toBe('Amiga de crianças');
    expect(saved.characteristics.specialCare).toBe('Medicação diária');
  });

  it('create: opcionais vazios não bloqueiam o cadastro (defaults do domínio)', async () => {
    const repository = new AnimalRepositoryFake();
    const { getByTestId } = await renderForm({ animalRepository: repository });

    await fireEvent.press(getByTestId('btn-capture-photo'));
    await fireEvent.changeText(getByTestId('input-name'), 'Thor Opcional');
    await fireEvent.press(getByTestId('btn-submit-animal'));

    await waitFor(() => expect(Array.from(repository.items.values())).toHaveLength(1));
    const saved = Array.from(repository.items.values())[0];
    expect(saved.characteristics.characteristics).toBe('');
    expect(saved.characteristics.behavior).toBe('');
    expect(saved.characteristics.specialCare).toBe('Nenhum');
  });

  it('edição: opcionais pré-preenchidos do agregado e alteráveis antes de salvar', async () => {
    const existing = makeAnimal({
      characteristics: makeCharacteristics({
        species: 'Gato',
        characteristics: 'Quieta',
        behavior: 'Sociável',
        specialCare: 'Dieta especial',
      }),
      photos: [makePhoto({ id: 'old', localPath: 'file:///old/a.jpg' })],
    });
    const repository = new AnimalRepositoryFake([existing]);
    const { getByTestId } = await renderForm({
      animalRepository: repository,
      initialAnimal: existing,
      ownerId: 'user_1',
    });

    expect(getByTestId('input-characteristics').props.value).toBe('Quieta');
    expect(getByTestId('input-behavior').props.value).toBe('Sociável');
    expect(getByTestId('input-special-care').props.value).toBe('Dieta especial');

    await fireEvent.changeText(getByTestId('input-behavior'), 'Sociável com gatos');
    await fireEvent.press(getByTestId('btn-submit-animal'));

    await waitFor(async () => {
      const saved = await repository.findById('animal_1');
      expect(saved?.characteristics.behavior).toBe('Sociável com gatos');
      expect(saved?.characteristics.characteristics).toBe('Quieta');
      expect(saved?.characteristics.specialCare).toBe('Dieta especial');
    });
  });
});
