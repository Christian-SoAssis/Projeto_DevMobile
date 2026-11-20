import { SupabasePhotoStorage, photoObjectPath } from '../../../infrastructure/supabase/storage/SupabasePhotoStorage';
import { AnimalPhoto } from '../../../domain/entities/AnimalPhoto';
import { InMemoryPhotoStorage } from '../../fakes/in-memory-repositories';

function makeSupabaseClient() {
  const uploaded: Record<string, any> = {};
  const bucketMock = {
    upload: jest.fn().mockImplementation(async (path: string) => {
      uploaded[path] = true;
      return { data: { path }, error: null };
    }),
    getPublicUrl: jest.fn().mockImplementation((path: string) => ({
      data: { publicUrl: `https://public.url/${path}` },
    })),
  };
  return {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
        error: null,
      }),
    },
    storage: {
      from: jest.fn(() => bucketMock),
    },
    _uploaded: uploaded,
    _bucketMock: bucketMock,
  } as any;
}

describe('SupabasePhotoStorage (DAT-08)', () => {
  it('deve construir o caminho do objeto no bucket com dono/animal/foto', () => {
    const path = photoObjectPath('user-1', 'animal-1', 'photo-1');
    expect(path).toBe('user-1/animal-1/photo-1.webp');
  });

  it('deve fazer upload de foto pendente e marcar como enviada', async () => {
    const client = makeSupabaseClient();
    const local = new InMemoryPhotoStorage();
    const storage = new SupabasePhotoStorage({
      local,
      client,
      readFile: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    });

    const photo = new AnimalPhoto({
      id: 'photo-1',
      animalId: 'animal-1',
      localPath: 'file:///photo.webp',
      remoteUrl: undefined,
    });

    await local.persistLocal(photo);

    const result = await storage.uploadPending(photo);

    expect(result.remoteUrl).toBeTruthy();
    expect(client._bucketMock.upload).toHaveBeenCalled();
  });

  it('não deve reenviar foto que já tem remoteUrl (idempotência)', async () => {
    const client = makeSupabaseClient();
    const local = new InMemoryPhotoStorage();
    const storage = new SupabasePhotoStorage({ local, client });

    const photo = new AnimalPhoto({
      id: 'photo-1',
      animalId: 'animal-1',
      localPath: 'file:///photo.webp',
      remoteUrl: 'https://existing.url/photo.webp',
    });

    await local.persistLocal(photo);

    const result = await storage.uploadPending(photo);

    expect(result.remoteUrl).toBe('https://existing.url/photo.webp');
    expect(client.storage.from('animal-photos').upload).not.toHaveBeenCalled();
  });

  it('deve lançar erro se não consegue ler o arquivo local', async () => {
    const client = makeSupabaseClient();
    const local = new InMemoryPhotoStorage();
    const storage = new SupabasePhotoStorage({
      local,
      client,
      readFile: jest.fn().mockRejectedValue(new Error('Erro de leitura')),
    });

    const photo = new AnimalPhoto({
      id: 'photo-1',
      animalId: 'animal-1',
      localPath: 'file:///photo.webp',
      remoteUrl: undefined,
    });

    await local.persistLocal(photo);

    await expect(storage.uploadPending(photo)).rejects.toThrow(
      'Não foi possível ler o arquivo da foto.'
    );
  });

  it('deve lançar erro se não há sessão de usuário autenticada', async () => {
    const client = makeSupabaseClient();
    client.auth.getSession = jest.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    });
    const local = new InMemoryPhotoStorage();
    const storage = new SupabasePhotoStorage({
      local,
      client,
      readFile: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    });

    const photo = new AnimalPhoto({
      id: 'photo-1',
      animalId: 'animal-1',
      localPath: 'file:///photo.webp',
      remoteUrl: undefined,
    });

    await local.persistLocal(photo);

    await expect(storage.uploadPending(photo)).rejects.toThrow(
      'Faça login para enviar fotos ao servidor.'
    );
  });
});
