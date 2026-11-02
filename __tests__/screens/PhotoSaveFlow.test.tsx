import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AnimalFormScreen } from '../../src/adapters/screens/AnimalFormScreen';
import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { SyncQueueRepositoryFake } from '../../src/application/fakes/SyncQueueRepositoryFake';
import { PhotoStorageFake } from '../../src/application/fakes/PhotoStorageFake';
import { CameraGateway, CameraPhotoResult } from '../../src/domain/ports/CameraGateway';
import { PhotoStorage } from '../../src/domain/ports/PhotoStorage';
import { AnimalPhoto } from '../../src/domain/entities/AnimalPhoto';

/**
 * Fluxo de salvamento da foto do anúncio (doc §5.1/§14.1):
 * câmera → arquivo COPIADO para o armazenamento seguro do app pelo
 * `PhotoStorage` (antes de anexar) → `AnimalPhoto` com o destino definitivo
 * no agregado → SQLite grava `animal_photos`/`local_images` na transação
 * do anúncio → sobrevive ao reinício (RNF01/RNF02) e mantém o item da
 * fila para upload remoto (Passo 4).
 */

const CAPTURED_URI = 'file:///expo-cache/anim-photo.jpg';
const PERSISTED_PREFIX = 'file:///persisted/animal_photos/';

class PersistingStorageSpy implements PhotoStorage {
  calls: AnimalPhoto[] = [];

  async persistLocal(photo: AnimalPhoto): Promise<AnimalPhoto> {
    this.calls.push(photo);
    // Simula a cópia física do arquivo: devolve NOVA entidade com o destino.
    return new AnimalPhoto({
      id: photo.id,
      animalId: photo.animalId,
      localPath: `${PERSISTED_PREFIX}${photo.id}.jpg`,
      createdAt: photo.createdAt,
    });
  }

  async listPendingUpload(): Promise<AnimalPhoto[]> {
    return [];
  }

  async uploadPending(photo: AnimalPhoto): Promise<AnimalPhoto> {
    return photo;
  }

  async remove(): Promise<void> {}
}

function cameraWith(uri: string | null): CameraGateway {
  return {
    capturePhoto: async () => (uri ? ({ uri } as CameraPhotoResult) : null),
    pickImageFromGallery: async () => null,
  } as unknown as CameraGateway;
}

describe('AnimalFormScreen — foto capturada pode ser salva no banco local de forma robusta', () => {
  it('foto capturada → PhotoStorage copia o arquivo e a foto no animal leva o destino persistido', async () => {
    const repo = new AnimalRepositoryFake();
    const storage = new PersistingStorageSpy();

    const { getByTestId, getByText } = await render(
      <AnimalFormScreen
        animalRepository={repo}
        syncQueueRepository={new SyncQueueRepositoryFake()}
        cameraGateway={cameraWith(CAPTURED_URI)}
        photoStorage={storage}
      />
    );

    await fireEvent.press(getByTestId('btn-capture-photo'));
    await waitFor(() => {
      expect(getByText('Foto capturada com sucesso!')).toBeTruthy();
    });

    await fireEvent.changeText(getByTestId('input-name'), 'Luna ComFoto');
    await fireEvent.press(getByTestId('btn-submit-animal'));
    await waitFor(() => {
      expect(getByText(/Anúncio cadastrado/)).toBeTruthy();
    });

    // 1) O PhotoStorage recebeu a foto (URI bruta da câmera) ANTES do anúncio.
    expect(storage.calls).toHaveLength(1);
    expect(storage.calls[0].localPath).toBe(CAPTURED_URI);
    // Ids são UUID: o Supabase usa `uuid` nas chaves primárias.
    expect(storage.calls[0].animalId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );

    // 2) A foto no agregado salvo aponta para o arquivo COPIADO — e não
    //    para os temp-files da câmera, que morrem quando o app é encerrado.
    const saved = Array.from(repo.items.values())[0];
    expect(saved.photos).toHaveLength(1);
    expect(saved.photos[0].localPath).toBe(`${PERSISTED_PREFIX}${saved.photos[0].id}.jpg`);
    expect(saved.photos[0].localPath).not.toBe(CAPTURED_URI);
  });

  it('sem foto capturada → nada é enviado ao PhotoStorage (anúncio segue sem foto)', async () => {
    const repo = new AnimalRepositoryFake();
    const storage = new PhotoStorageFake();

    const { getByTestId, getByText } = await render(
      <AnimalFormScreen
        animalRepository={repo}
        syncQueueRepository={new SyncQueueRepositoryFake()}
        cameraGateway={cameraWith(null)}
        photoStorage={storage}
      />
    );

    await fireEvent.changeText(getByTestId('input-name'), 'SemFoto');
    await fireEvent.press(getByTestId('btn-submit-animal'));
    await waitFor(() => {
      expect(getByText(/Anúncio cadastrado/)).toBeTruthy();
    });

    expect(storage.photos.size).toBe(0);
    const saved = Array.from(repo.items.values())[0];
    expect(saved.photos).toHaveLength(0);
  });
});
