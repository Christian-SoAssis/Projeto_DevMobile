import {
  ImagePickerCameraAdapter,
  ImagePickerModule,
} from '../../../../src/infrastructure/device/camera/ImagePickerCameraAdapter';

function buildFakeImagePicker(options: {
  cameraGranted?: boolean;
  launchResult?: () => unknown;
  pickResult?: () => unknown;
}): ImagePickerModule {
  return {
    requestCameraPermissionsAsync: async () => ({ granted: options.cameraGranted ?? true }),
    launchCameraAsync: async () =>
      (options.launchResult?.() ?? { canceled: false, assets: [{ uri: 'file://fake.jpg' }] }) as any,
    pickImageAsync: async () =>
      (options.pickResult?.() ?? { canceled: false, assets: [{ uri: 'file://picked.jpg' }] }) as any,
  };
}

describe('ImagePickerCameraAdapter — câmera/galeria com expo-image-picker (RF09/RF26)', () => {
  it('captura foto da câmera quando a permissão é concedida e devolve a URI local', async () => {
    const adapter = new ImagePickerCameraAdapter({
      imagePickerModule: buildFakeImagePicker({}),
    });

    const photo = await adapter.capturePhoto();

    expect(photo).not.toBeNull();
    expect(photo!.uri).toBe('file://fake.jpg');
  });

  it('câmera com permissão negada devolve null — não lança erro (doc §16.3)', async () => {
    const adapter = new ImagePickerCameraAdapter({
      imagePickerModule: buildFakeImagePicker({ cameraGranted: false }),
    });

    await expect(adapter.capturePhoto()).resolves.toBeNull();
  });

  it('usuario cancela a captura devolve null sem erro', async () => {
    const adapter = new ImagePickerCameraAdapter({
      imagePickerModule: buildFakeImagePicker({
        launchResult: () => ({ canceled: true, assets: [] }),
      }),
    });

    await expect(adapter.capturePhoto()).resolves.toBeNull();
  });

  it('câmera sem asset preenchido devolve null', async () => {
    const adapter = new ImagePickerCameraAdapter({
      imagePickerModule: buildFakeImagePicker({
        launchResult: () => ({ canceled: false, assets: [{}] }),
      }),
    });

    await expect(adapter.capturePhoto()).resolves.toBeNull();
  });

  it('crash da ponte nativa na câmera devolve null (degradação segura)', async () => {
    const adapter = new ImagePickerCameraAdapter({
      imagePickerModule: buildFakeImagePicker({
        launchResult: () => {
          throw new Error('bridge');
        },
      }),
    });

    await expect(adapter.capturePhoto()).resolves.toBeNull();
  });

  it('galeria seleciona imagem quando o usuário escolhe', async () => {
    const adapter = new ImagePickerCameraAdapter({
      imagePickerModule: buildFakeImagePicker({}),
    });

    const photo = await adapter.pickImageFromGallery();

    expect(photo).not.toBeNull();
    expect(photo!.uri).toBe('file://picked.jpg');
  });

  it('galeria cancelada/quebrada devolve null — fluxo segue sem foto (狼="#"><', async () => {
    const cancelada = new ImagePickerCameraAdapter({
      imagePickerModule: buildFakeImagePicker({
        pickResult: () => ({ canceled: true }),
      }),
    });
    await expect(cancelada.pickImageFromGallery()).resolves.toBeNull();

    const quebrada = new ImagePickerCameraAdapter({
      imagePickerModule: buildFakeImagePicker({
        pickResult: () => {
          throw new Error('denied');
        },
      }),
    });
    await expect(quebrada.pickImageFromGallery()).resolves.toBeNull();
  });

  it('sem módulo (`NODE_ENV` de teste/demo) os dois fluxos devolvem null', async () => {
    // npm sem expo-image-picker: require dinâmico sai pelo catch do adapter.
    const adapter = new ImagePickerCameraAdapter({ imagePickerModule: null });

    await expect(adapter.capturePhoto()).resolves.toBeNull();
    await expect(adapter.pickImageFromGallery()).resolves.toBeNull();
  });

  it('qualidade padrão é aplicada nas chamadas de captura', async () => {
    const launch = jest.fn().mockResolvedValue({ canceled: true });
    const pick = jest.fn().mockResolvedValue({ canceled: true });
    const adapter = new ImagePickerCameraAdapter({
      imagePickerModule: {
        requestCameraPermissionsAsync: async () => ({ granted: true }),
        launchCameraAsync: launch,
        pickImageAsync: pick,
      },
      quality: 0.4,
    });

    await adapter.capturePhoto();
    await adapter.pickImageFromGallery();

    expect(launch).toHaveBeenCalledWith({ quality: 0.4 });
    expect(pick).toHaveBeenCalledWith({ quality: 0.4 });
  });
});
