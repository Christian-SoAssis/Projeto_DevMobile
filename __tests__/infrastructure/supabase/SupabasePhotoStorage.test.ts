import { AnimalPhoto } from '../../../src/domain/entities/AnimalPhoto';
import { PhotoStorageFake } from '../../../src/application/fakes/PhotoStorageFake';
import {
  SupabasePhotoStorage,
  PhotoUploadError,
  photoObjectPath,
  PHOTO_BUCKET,
} from '../../../src/infrastructure/supabase/storage/SupabasePhotoStorage';
import { FakeSupabaseClient, FAKE_BUCKET_MAX_BYTES } from '../../../test-support/SupabaseFake';

const UID = '3e0d7a30-1111-4444-8888-999999999999';

function setup(
  currentUserId: string | null = UID,
  readFile: (uri: string) => Promise<Uint8Array> = async () => new Uint8Array([1, 2, 3])
) {
  const client = new FakeSupabaseClient({
    context: { db: { animals: [], users: [] }, currentUserId, isAdmin: false },
  });
  const local = new PhotoStorageFake();
  const storage = new SupabasePhotoStorage({ local, client, readFile });
  return { client, local, storage };
}

const webp = (over: Partial<ConstructorParameters<typeof AnimalPhoto>[0]> = {}) =>
  new AnimalPhoto({ id: 'photo-1', animalId: 'animal-1', localPath: 'file:///app/photo-1.webp', ...over });

describe('SupabasePhotoStorage (bucket animal-photos)', () => {
  it('envia o WebP para {uid}/{animal}/{foto}.webp e registra a URL pública', async () => {
    const { client, storage, local } = setup();
    const result = await storage.uploadPending(webp());

    const path = photoObjectPath(UID, 'animal-1', 'photo-1');
    expect(path).toBe(`${UID}/animal-1/photo-1.webp`);
    expect(client.storageObjects.get(path)).toMatchObject({
      bucket: PHOTO_BUCKET,
      contentType: 'image/webp',
    });
    expect(result.remoteUrl).toBe(
      `https://fake.supabase.co/storage/v1/object/public/${PHOTO_BUCKET}/${path}`
    );
    expect(result.syncState.isCompleted()).toBe(true);
    // O armazenamento local também registrou a URL remota.
    expect(local.photos.get('photo-1')?.remoteUrl).toBe(result.remoteUrl);
  });

  it('reenviar uma foto já enviada é idempotente (não sobe de novo)', async () => {
    const { client, storage } = setup();
    const first = await storage.uploadPending(webp());
    const spy = jest.spyOn(client.storage, 'from');
    const second = await storage.uploadPending(first);
    expect(second.remoteUrl).toBe(first.remoteUrl);
    expect(spy).not.toHaveBeenCalled();
  });

  it('recusa arquivo que não é WebP (conversão obrigatória)', async () => {
    const { client, storage } = setup();
    await expect(storage.uploadPending(webp({ localPath: 'file:///app/photo-1.jpg' }))).rejects.toThrow(
      'A foto precisa estar em WebP antes do envio.'
    );
    expect(client.storageObjects.size).toBe(0);
  });

  it('sem login → erro claro e nada enviado', async () => {
    const { client, storage } = setup(null);
    await expect(storage.uploadPending(webp())).rejects.toThrow('Faça login para enviar fotos ao servidor.');
    expect(client.storageObjects.size).toBe(0);
  });

  it('arquivo ilegível → erro claro e nada enviado', async () => {
    const { client, storage } = setup(UID, async () => {
      throw new Error('ENOENT');
    });
    await expect(storage.uploadPending(webp())).rejects.toThrow('Não foi possível ler o arquivo da foto.');
    expect(client.storageObjects.size).toBe(0);
  });

  it('foto sem arquivo local e sem URL remota é recusada pela própria entidade', () => {
    expect(() => new AnimalPhoto({ id: 'p', animalId: 'a' })).toThrow();
  });

  it('RLS: o servidor recusa gravar na pasta de outro usuário', async () => {
    const { client } = setup();
    const res = await client.storage
      .from(PHOTO_BUCKET)
      .upload('outro-usuario/animal-1/photo-1.webp', new Uint8Array([1]), { contentType: 'image/webp' });
    expect(res.error?.message).toContain('row-level security');
    expect(client.storageObjects.size).toBe(0);
  });

  it('erro devolvido pelo servidor no upload vira PhotoUploadError', async () => {
    const { client, storage } = setup();
    (client.storage as { from: unknown }).from = () => ({
      upload: async () => ({ data: null, error: { message: 'row-level security' } }),
      remove: async () => ({ error: null }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
    });
    await expect(storage.uploadPending(webp())).rejects.toBeInstanceOf(PhotoUploadError);
  });

  it('o bucket recusa arquivo acima do limite e tipo diferente de WebP', async () => {
    const big = setup(UID, async () => new Uint8Array(FAKE_BUCKET_MAX_BYTES + 1));
    await expect(big.storage.uploadPending(webp())).rejects.toThrow('Falha no envio da foto');

    const bucket = setup().client.storage.from(PHOTO_BUCKET);
    const res = await bucket.upload(`${UID}/a/p.jpg`, new Uint8Array([1]), { contentType: 'image/jpeg' });
    expect(res.error?.message).toContain('not supported');
  });

  it('exceção de rede no upload vira PhotoUploadError', async () => {
    const { client, storage } = setup();
    (client.storage as { from: unknown }).from = () => ({
      upload: async () => {
        throw new Error('network down');
      },
      remove: async () => ({ error: null }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
    });
    await expect(storage.uploadPending(webp())).rejects.toThrow('Falha no envio da foto: network down');
  });

  it('persistência local, fila pendente e remoção delegam ao armazenamento local', async () => {
    const { storage, local } = setup();
    await storage.persistLocal(webp());
    expect(await storage.listPendingUpload()).toHaveLength(1);
    await storage.remove('photo-1');
    expect(local.photos.has('photo-1')).toBe(false);
  });
});
