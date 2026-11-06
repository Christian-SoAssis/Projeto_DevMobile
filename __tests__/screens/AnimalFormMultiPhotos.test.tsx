import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AnimalFormScreen } from '../../src/adapters/screens/AnimalFormScreen';
import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { SyncQueueRepositoryFake } from '../../src/application/fakes/SyncQueueRepositoryFake';
import { PhotoStorageFake } from '../../src/application/fakes/PhotoStorageFake';
import { CameraGateway, CameraPhotoResult } from '../../src/domain/ports/CameraGateway';
import { makeAnimal, makePhoto } from '../../test-support/fixtures';

/**
 * RF09 + decisão de produto: o formulário aceita ATÉ 4 fotos por anúncio,
 * vindas da câmera OU da galeria, com remoção e reordenação antes de salvar.
 */

function cameraSequence(): CameraGateway {
  const uris = [0, 1, 2, 3, 4].map((i) => `file:///cap/foto-${i}.jpg`);
  let call = 0;
  return {
    capturePhoto: async () => (call < uris.length ? ({ uri: uris[call++] } as CameraPhotoResult) : null),
    pickImageFromGallery: async () => null,
  } as unknown as CameraGateway;
}

function counterOf(element: { props: Record<string, unknown> }): string {
  return ((element.props.children as unknown[] | undefined) ?? []).join('');
}

describe('AnimalFormScreen — múltiplas fotos com limite de 4', () => {
  it('permite até 4 fotos e bloqueia a 5ª com o aviso do limite', async () => {
    const { getByTestId, getByText } = await render(
      <AnimalFormScreen
        animalRepository={new AnimalRepositoryFake()}
        syncQueueRepository={new SyncQueueRepositoryFake()}
        cameraGateway={cameraSequence()}
        photoStorage={new PhotoStorageFake()}
      />
    );

    for (let i = 0; i < 4; i++) {
      await fireEvent.press(getByTestId('btn-capture-photo'));
      await waitFor(() => expect(counterOf(getByTestId('photo-count'))).toBe(`${i + 1}/4 fotos`));
    }

    await fireEvent.press(getByTestId('btn-capture-photo'));
    await waitFor(() => {
      expect(getByText('Máximo de 4 fotos por anúncio (RF09).')).toBeTruthy();
    });
    // O contador continua no limite.
    expect(counterOf(getByTestId('photo-count'))).toBe('4/4 fotos');
  });

  it('galeria também respeita o limite de 4 fotos por anúncio', async () => {
    const gateway: CameraGateway = {
      capturePhoto: async () => null,
      pickImageFromGallery: async () => ({ uri: 'file:///gal/foto.jpg' } as CameraPhotoResult),
    } as unknown as CameraGateway;
    const { getByTestId, getByText } = await render(
      <AnimalFormScreen
        animalRepository={new AnimalRepositoryFake()}
        syncQueueRepository={new SyncQueueRepositoryFake()}
        cameraGateway={gateway}
        photoStorage={new PhotoStorageFake()}
      />
    );
    for (let i = 0; i < 4; i++) {
      await fireEvent.press(getByTestId('btn-pick-gallery'));
      await waitFor(() => expect(counterOf(getByTestId('photo-count'))).toBe(`${i + 1}/4 fotos`));
    }

    await fireEvent.press(getByTestId('btn-pick-gallery'));
    await waitFor(() => expect(getByText('Máximo de 4 fotos por anúncio (RF09).')).toBeTruthy());
  });

  it('salva todas as fotos capturadas (cada uma persistida antes de entrar no agregado)', async () => {
    const storage = new PhotoStorageFake();
    const repo = new AnimalRepositoryFake();
    const { getByTestId, getByText } = await render(
      <AnimalFormScreen
        animalRepository={repo}
        syncQueueRepository={new SyncQueueRepositoryFake()}
        cameraGateway={cameraSequence()}
        photoStorage={storage}
      />
    );

    for (let i = 0; i < 2; i++) {
      await fireEvent.press(getByTestId('btn-capture-photo'));
      await waitFor(() => expect(counterOf(getByTestId('photo-count'))).toBe(`${i + 1}/4 fotos`));
    }

    await fireEvent.changeText(getByTestId('input-name'), 'Luna MultiFotos');
    await fireEvent.press(getByTestId('btn-submit-animal'));
    await waitFor(() => expect(getByText(/Anúncio cadastrado/)).toBeTruthy());

    const saved = Array.from(repo.items.values())[0];
    expect(saved.photos).toHaveLength(2);
    expect(storage.photos.size).toBe(2);
    // Fotos novas anexadas ao animal vindo da câmera.
    for (const photo of saved.photos) {
      expect(photo).toMatchObject({ animalId: saved.id });
    }
  });

  it('remover foto de edição limpa a cópia física e o agregado', async () => {
    const existing = makeAnimal({
      photos: [makePhoto({ id: 'old', localPath: 'file:///old/a.jpg' }), makePhoto({ id: 'old2', localPath: 'file:///old/b.jpg' })],
    });
    const repo = new AnimalRepositoryFake([existing]);
    const storage = new PhotoStorageFake();
    const removeSpy = jest.spyOn(storage, 'remove');
    const { getByTestId } = await render(
      <AnimalFormScreen
        initialAnimal={existing}
        ownerId="user_1"
        animalRepository={repo}
        syncQueueRepository={new SyncQueueRepositoryFake()}
        cameraGateway={cameraSequence()}
        photoStorage={storage}
      />
    );

    await fireEvent.press(getByTestId('btn-remove-photo-0'));
    await waitFor(() => expect(counterOf(getByTestId('photo-count'))).toBe('1/4 fotos'));
    expect(removeSpy).toHaveBeenCalledWith('old');

    await fireEvent.press(getByTestId('btn-submit-animal'));
    await waitFor(async () => {
      const saved = await repo.findById('animal_1');
      expect(saved?.photos.map((p) => p.id)).toEqual(['old2']);
    });
  });

  it('reordenação por ◀/▶ define a ordem das fotos do anúncio', async () => {
    const existing = makeAnimal({
      photos: [makePhoto({ id: 'a', localPath: 'file:///old/a.jpg' }), makePhoto({ id: 'b', localPath: 'file:///old/b.jpg' })],
    });
    const repo = new AnimalRepositoryFake([existing]);
    const { getByTestId } = await render(
      <AnimalFormScreen
        initialAnimal={existing}
        ownerId="user_1"
        animalRepository={repo}
        syncQueueRepository={new SyncQueueRepositoryFake()}
        cameraGateway={cameraSequence()}
        photoStorage={new PhotoStorageFake()}
      />
    );

    // Segunda foto sobe para a primeira posição.
    await fireEvent.press(getByTestId('btn-photo-left-1'));

    await fireEvent.press(getByTestId('btn-submit-animal'));
    await waitFor(async () => {
      const saved = await repo.findById('animal_1');
      expect(saved?.photos.map((p) => p.id)).toEqual(['b', 'a']);
    });
  });
});
