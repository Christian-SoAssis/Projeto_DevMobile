import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AnimalPhotoView } from '../../src/adapters/components/AnimalPhotoView';
import { AnimalDetailsScreen } from '../../src/adapters/screens/AnimalDetailsScreen';
import { AnimalFormScreen } from '../../src/adapters/screens/AnimalFormScreen';
import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { SyncQueueRepositoryFake } from '../../src/application/fakes/SyncQueueRepositoryFake';
import { makeAnimal, makePhoto } from '../../test-support/fixtures';

/**
 * Visualização da foto do anúncio (RF09):
 * - arquivo local primeiro (cache offline abre sem rede);
 * - URL remota como fallback quando o local não existe ou falha;
 * - placeholder 🐾 quando o anúncio ainda não tem foto.
 *
 * Telas cobertas: detalhes do animal e cadastro/edição do anúncio.
 */

const LOCAL_URI = 'file:///persisted/animal_photos/photo_1.webp';
const REMOTE_URL = 'https://storage.example.com/photos/photo_1.webp';

async function renderView(props: Parameters<typeof AnimalPhotoView>[0]) {
  return render(<AnimalPhotoView {...props} />);
}

describe('AnimalPhotoView — resolução da URI da foto', () => {
  it('prefere o arquivo local quando a foto tem localPath e remoteUrl', async () => {
    const { getByTestId, queryByTestId } = await renderView({
      photo: makePhoto({ localPath: LOCAL_URI, remoteUrl: REMOTE_URL }),
      testID: 'photo',
    });

    expect(getByTestId('photo').props.source).toEqual({ uri: LOCAL_URI });
    expect(queryByTestId('photo-placeholder')).toBeNull();
  });

  it('usa a URL remota quando a foto é só-remota (sem arquivo local)', async () => {
    const { getByTestId } = await renderView({
      photo: makePhoto({ localPath: undefined, remoteUrl: REMOTE_URL }),
      testID: 'photo',
    });

    expect(getByTestId('photo').props.source).toEqual({ uri: REMOTE_URL });
  });

  it('a uri direta (captura recém-feita) vence a foto persistida', async () => {
    const { getByTestId } = await renderView({
      photo: makePhoto({ localPath: LOCAL_URI }),
      uri: 'file:///expo-cache/captura.jpg',
      testID: 'photo',
    });

    expect(getByTestId('photo').props.source).toEqual({ uri: 'file:///expo-cache/captura.jpg' });
  });

  it('sem foto: exibe o placeholder 🐾', async () => {
    const { getByTestId, queryByTestId } = await renderView({ testID: 'photo' });

    expect(queryByTestId('photo')).toBeNull();
    expect(getByTestId('photo-placeholder')).toBeTruthy();
  });

  it('arquivo local falhou no carregamento → tenta a URL remota; se ela falhar → placeholder', async () => {
    const { getByTestId, queryByTestId } = await renderView({
      photo: makePhoto({ localPath: LOCAL_URI, remoteUrl: REMOTE_URL }),
      testID: 'photo',
    });

    // O cache local quebrou (arquivo apagado/URI de temp): cai para a remota.
    await act(async () => {
      getByTestId('photo').props.onError!();
    });
    expect(getByTestId('photo').props.source).toEqual({ uri: REMOTE_URL });

    // A remota também falha (sem internet): placeholder, sem imagem quebrada.
    await act(async () => {
      getByTestId('photo').props.onError!();
    });
    expect(queryByTestId('photo')).toBeNull();
    expect(getByTestId('photo-placeholder')).toBeTruthy();
  });

  it('trocar a foto (uri direta) zera o estado de falha do carregamento anterior', async () => {
    const { rerender, getByTestId, queryByTestId } = await render(
      <AnimalPhotoView photo={makePhoto({ localPath: LOCAL_URI, remoteUrl: REMOTE_URL })} testID="photo" />
    );

    // Falha no carregamento do arquivo local: cai para a URL remota.
    await act(async () => {
      getByTestId('photo').props.onError!();
    });
    expect(getByTestId('photo').props.source).toEqual({ uri: REMOTE_URL });

    // Nova captura no formulário: outra URI e o histórico de falha não se herda.
    await rerender(
      <AnimalPhotoView
        photo={makePhoto({ localPath: LOCAL_URI, remoteUrl: REMOTE_URL })}
        uri="file:///expo-cache/nova.jpg"
        testID="photo"
      />
    );
    expect(getByTestId('photo').props.source).toEqual({ uri: 'file:///expo-cache/nova.jpg' });
    expect(queryByTestId('photo-placeholder')).toBeNull();
  });
});

describe('AnimalDetailsScreen — foto na página do animal', () => {
  it('exibe a foto persistida no topo', async () => {
    const animal = makeAnimal({ photos: [makePhoto({ localPath: LOCAL_URI, remoteUrl: REMOTE_URL })] });

    const { getByTestId, queryByTestId } = await render(
      <AnimalDetailsScreen animal={animal} currentUserId={null} animalRepository={new AnimalRepositoryFake([animal])} />
    );

    expect(getByTestId('animal-photo').props.source).toEqual({ uri: LOCAL_URI });
    expect(queryByTestId('animal-photo-placeholder')).toBeNull();
  });

  it('anúncio sem foto: mostra o placeholder e segue utilizável', async () => {
    const animal = makeAnimal();

    const { getByTestId, getByText } = await render(
      <AnimalDetailsScreen animal={animal} currentUserId={null} animalRepository={new AnimalRepositoryFake([animal])} />
    );

    expect(getByTestId('animal-photo-placeholder')).toBeTruthy();
    expect(getByText('Luna')).toBeTruthy();
  });
});

describe('AnimalFormScreen — pré-visualização da foto no cadastro', () => {
  it('começa com placeholder e mostra a foto capturada imediatamente', async () => {
    const { getByTestId, queryByTestId } = await render(
      <AnimalFormScreen
        animalRepository={new AnimalRepositoryFake()}
        syncQueueRepository={new SyncQueueRepositoryFake()}
      />
    );

    expect(getByTestId('form-photo-preview-placeholder')).toBeTruthy();

    // CameraGatewayFake devolve file://fake_photo_captured.jpg.
    await fireEvent.press(getByTestId('btn-capture-photo'));
    await waitFor(() => {
      expect(getByTestId('form-photo-preview').props.source).toEqual({
        uri: 'file://fake_photo_captured.jpg',
      });
    });
    expect(queryByTestId('form-photo-preview-placeholder')).toBeNull();
  });

  it('em edição: a foto atual do anúncio aparece sem nova captura', async () => {
    const existing = makeAnimal({ photos: [makePhoto({ id: 'old', localPath: LOCAL_URI })] });

    const { getByTestId, queryByTestId } = await render(
      <AnimalFormScreen
        initialAnimal={existing}
        ownerId="user_1"
        animalRepository={new AnimalRepositoryFake([existing])}
        syncQueueRepository={new SyncQueueRepositoryFake()}
      />
    );

    expect(getByTestId('form-photo-preview').props.source).toEqual({ uri: LOCAL_URI });
    expect(queryByTestId('form-photo-preview-placeholder')).toBeNull();
  });
});
