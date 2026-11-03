import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AnimalFormScreen } from '../../src/adapters/screens/AnimalFormScreen';
import { SyncStatusScreen } from '../../src/adapters/screens/SyncStatusScreen';
import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { SyncQueueRepositoryFake } from '../../src/application/fakes/SyncQueueRepositoryFake';
import { LocationPermissionDeniedError } from '../../src/infrastructure/device/location/LocationAdapter';
import {
  OFFLINE_STATUS_LABELS,
} from '../../src/application/offline/OfflineCapabilities';

/**
 * Contratos de falha do hardware (doc §16.3 Dispositivo):
 * - UC01-A3: permissão de localização negada NÃO quebra o app — a UI
 *   orienta o preenchimento manual e nenhum campo é corrompido.
 * - Câmera negada / cancelada: feedback claro permitindo seguir sem foto.
 * - Galeria cancelada / negada: mesma degradação com feedback explícito.
 */

function FormWithGateway(props: {
  getCurrentLocation: () => Promise<any>;
  capturePhoto?: () => Promise<any>;
  pickImageFromGallery?: () => Promise<any>;
}) {
  return (
    <AnimalFormScreen
      animalRepository={new AnimalRepositoryFake()}
      syncQueueRepository={new SyncQueueRepositoryFake()}
      locationGateway={{ getCurrentLocation: props.getCurrentLocation } as any}
      cameraGateway={
        props.capturePhoto || props.pickImageFromGallery
          ? ({
              capturePhoto: props.capturePhoto ?? (async () => null),
              pickImageFromGallery: props.pickImageFromGallery ?? (async () => null),
            } as any)
          : undefined
      }
    />
  );
}

describe('AnimalFormScreen — falhas de hardware tratadas com feedback (UC01-A3)', () => {
  it('permissão de GPS negada → mensagem manual, sem crash e campos preservados', async () => {
    const { getByTestId, getByText, queryByText } = await render(
      <FormWithGateway
        getCurrentLocation={async () => {
          throw new LocationPermissionDeniedError();
        }}
      />
    );

    await fireEvent.press(getByTestId('btn-capture-location'));

    await waitFor(() => {
      expect(getByText('Geolocalização indisponível neste momento. Preencha bairro e cidade manualmente.')).toBeTruthy();
    });
    expect(getByTestId('location-status')).toBeTruthy();
    // Campos de cidade/bairro permanecem nos padrões (nada gravado com lixo).
    expect(queryByText('Cidade não identificada')).toBeNull();
  });

  it('GPS indisponível (erro genérico) também orienta o preenchimento manual', async () => {
    const { getByTestId, getByText } = await render(
      <FormWithGateway
        getCurrentLocation={async () => {
          const err = new Error('Falha do GPS');
          err.name = 'LocationUnavailableError';
          throw err;
        }}
      />
    );

    await fireEvent.press(getByTestId('btn-capture-location'));

    await waitFor(() => {
      expect(getByText('Geolocalização indisponível neste momento. Preencha bairro e cidade manualmente.')).toBeTruthy();
    });
  });

  it('câmera negada/cancelada → feedback “Nenhuma foto capturada” e formulário segue utilizável', async () => {
    const { getByTestId, getByText } = await render(
      <FormWithGateway capturePhoto={async () => null} getCurrentLocation={async () => {
        throw new LocationPermissionDeniedError();
      }} />
    );

    await fireEvent.press(getByTestId('btn-capture-photo'));

    await waitFor(() => {
      expect(getByText('Nenhuma foto capturada. Conceda a permissão da câmera ou salve o anúncio sem foto.')).toBeTruthy();
    });

    // O cadastro continua possível sem foto (RF26 — offline até o upload).
    await fireEvent.changeText(getByTestId('input-name'), 'SemFoto');
    await fireEvent.press(getByTestId('btn-submit-animal'));
    await waitFor(() => {
      expect(getByText(/Anúncio cadastrado e sincronizado remotamente!/)).toBeTruthy();
    });
  });

  it('galeria cancelada/negada → feedback “Nenhuma foto selecionada” e formulário segue utilizável', async () => {
    const { getByTestId, getByText } = await render(
      <FormWithGateway pickImageFromGallery={async () => null} getCurrentLocation={async () => {
        throw new LocationPermissionDeniedError();
      }} />
    );

    await fireEvent.press(getByTestId('btn-pick-gallery'));

    await waitFor(() => {
      expect(getByText('Nenhuma foto selecionada. Conceda a permissão da galeria ou salve o anúncio sem foto.')).toBeTruthy();
    });
    // Ainda sem foto no preview: o preview é placeholder.
    expect(getByTestId('form-photo-preview-placeholder')).toBeTruthy();

    // O cadastro continua possível sem foto (RF26 — offline até o upload).
    await fireEvent.changeText(getByTestId('input-name'), 'SemGaleria');
    await fireEvent.press(getByTestId('btn-submit-animal'));
    await waitFor(() => {
      expect(getByText(/Anúncio cadastrado e sincronizado remotamente!/)).toBeTruthy();
    });
  });
});

describe('SyncStatusScreen — seção de referência das funcionalidades offline (RF22)', () => {
  it('lista as capacidades offline e os cinco estados visuais inequívocos', async () => {
    const { getByTestId, getByText, getAllByText } = await render(<SyncStatusScreen />);

    expect(getByTestId('offline-capabilities-section')).toBeTruthy();
    expect(getByTestId('capability-criar_anuncio')).toBeTruthy();
    expect(getByTestId('capability-busca_anuncios')).toBeTruthy();
    expect(getByTestId('capability-favoritar_animal')).toBeTruthy();

    expect(getByText(new RegExp(OFFLINE_STATUS_LABELS.OFFLINE))).toBeTruthy();
    expect(getAllByText(/Funciona offline e entra na fila de sincronização/).length).toBeGreaterThan(0);
  });
});
