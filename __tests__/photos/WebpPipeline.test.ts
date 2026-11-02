import { AnimalPhoto } from '../../src/domain/entities/AnimalPhoto';
import { ImageConversionError } from '../../src/domain/ports/ImageProcessor';
import { newUuid } from '../../src/domain/services/IdGenerator';
import { PhotoStorageFake } from '../../src/application/fakes/PhotoStorageFake';
import { ImageProcessorFake } from '../../src/application/fakes/ImageProcessorFake';
import { WebpPhotoStorage } from '../../src/application/photos/WebpPhotoStorage';
import {
  ExpoImageManipulatorAdapter,
  MAX_IMAGE_SIDE,
  WEBP_QUALITY,
  fitWithin,
} from '../../src/infrastructure/device/image/ExpoImageManipulatorAdapter';
import { base64ToBytes } from '../../src/infrastructure/supabase/storage/base64';

const photo = (localPath?: string, remoteUrl?: string) =>
  new AnimalPhoto({ id: 'p1', animalId: 'a1', localPath, remoteUrl });

describe('newUuid', () => {
  it('gera UUID v4 válido e diferente a cada chamada', () => {
    const re = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const a = newUuid();
    expect(a).toMatch(re);
    expect(newUuid()).not.toBe(a);
    expect(newUuid(() => 0)).toMatch(re);
  });
});

describe('WebpPhotoStorage (conversão obrigatória)', () => {
  it('converte para WebP ANTES de persistir e guarda a foto convertida', async () => {
    const inner = new PhotoStorageFake();
    const processor = new ImageProcessorFake();
    const storage = new WebpPhotoStorage(inner, processor);

    const saved = await storage.persistLocal(photo('file:///cache/cam.jpg'));

    expect(processor.converted).toEqual(['file:///cache/cam.jpg']);
    expect(saved.localPath).toBe('file:///cache/cam.webp');
    expect(inner.photos.get('p1')?.localPath).toBe('file:///cache/cam.webp');
    expect(saved.id).toBe('p1');
    expect(saved.animalId).toBe('a1');
  });

  it('falha na conversão: lança erro e não grava nada', async () => {
    const inner = new PhotoStorageFake();
    const processor = new ImageProcessorFake();
    processor.shouldFail = true;
    const storage = new WebpPhotoStorage(inner, processor);

    await expect(storage.persistLocal(photo('file:///cache/cam.jpg'))).rejects.toBeInstanceOf(
      ImageConversionError
    );
    expect(inner.photos.size).toBe(0);
  });

  it('foto só-remota passa direto; demais métodos delegam', async () => {
    const inner = new PhotoStorageFake();
    const processor = new ImageProcessorFake();
    const storage = new WebpPhotoStorage(inner, processor);

    await storage.persistLocal(photo(undefined, 'https://x/y.webp'));
    expect(processor.converted).toEqual([]);

    await inner.persistLocal(photo('file:///a.webp'));
    expect(await storage.listPendingUpload()).toHaveLength(1);
    const uploaded = await storage.uploadPending(photo('file:///a.webp'));
    expect(uploaded.remoteUrl).toContain('p1');
    await storage.remove('p1');
  });
});

describe('ExpoImageManipulatorAdapter', () => {
  it('fitWithin reduz mantendo proporção e nunca amplia', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: MAX_IMAGE_SIDE, height: 960 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 960, height: MAX_IMAGE_SIDE });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  function manipulator() {
    return {
      manipulateAsync: jest.fn(async (..._args: unknown[]) => ({ uri: 'file:///out.webp' })),
      SaveFormat: { WEBP: 'webp' },
    };
  }

  it('foto grande: redimensiona e salva em WebP com a qualidade definida', async () => {
    const m = manipulator();
    const adapter = new ExpoImageManipulatorAdapter({
      manipulator: m,
      readSize: async () => ({ width: 4000, height: 3000 }),
    });
    expect(await adapter.toWebp('file:///in.jpg')).toBe('file:///out.webp');
    expect(m.manipulateAsync).toHaveBeenCalledWith(
      'file:///in.jpg',
      [{ resize: { width: 1280, height: 960 } }],
      { compress: WEBP_QUALITY, format: 'webp' }
    );
  });

  it('foto pequena ou sem dimensões: converte sem redimensionar', async () => {
    const small = manipulator();
    await new ExpoImageManipulatorAdapter({
      manipulator: small,
      readSize: async () => ({ width: 500, height: 400 }),
    }).toWebp('f.jpg');
    expect(small.manipulateAsync.mock.calls[0][1]).toEqual([]);

    const unknown = manipulator();
    await new ExpoImageManipulatorAdapter({
      manipulator: unknown,
      readSize: async () => null,
    }).toWebp('f.jpg');
    expect(unknown.manipulateAsync.mock.calls[0][1]).toEqual([]);
  });

  it('módulo ausente ou erro do manipulador → ImageConversionError (sem devolver o original)', async () => {
    await expect(new ExpoImageManipulatorAdapter({ manipulator: null }).toWebp('f.jpg')).rejects.toBeInstanceOf(
      ImageConversionError
    );
    const broken = {
      manipulateAsync: jest.fn(async () => {
        throw new Error('boom');
      }),
      SaveFormat: { WEBP: 'webp' },
    };
    await expect(
      new ExpoImageManipulatorAdapter({ manipulator: broken, readSize: async () => null }).toWebp('f.jpg')
    ).rejects.toBeInstanceOf(ImageConversionError);
  });
});

describe('base64ToBytes', () => {
  it('decodifica com e sem padding', () => {
    expect(Array.from(base64ToBytes('SGk='))).toEqual([72, 105]);
    expect(Array.from(base64ToBytes('SGVsbG8'))).toEqual([72, 101, 108, 108, 111]);
    expect(Array.from(base64ToBytes('AAEC/w=='))).toEqual([0, 1, 2, 255]);
    expect(base64ToBytes('').length).toBe(0);
  });
});
