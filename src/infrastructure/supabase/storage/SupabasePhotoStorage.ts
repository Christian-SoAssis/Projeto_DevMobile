import { AnimalPhoto } from '../../../domain/entities/AnimalPhoto';
import { PhotoStorage } from '../../../domain/ports/PhotoStorage';
import { SupabaseClientLike } from '../types';
import { base64ToBytes } from './base64';

export const PHOTO_BUCKET = 'animal-photos';
export const PHOTO_CONTENT_TYPE = 'image/webp';

export class PhotoUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhotoUploadError';
  }
}

/** Caminho do objeto no bucket: a 1ª pasta é o dono (a RLS confere `auth.uid()`). */
export function photoObjectPath(userId: string, animalId: string, photoId: string): string {
  return `${userId}/${animalId}/${photoId}.webp`;
}

export type FileReader = (uri: string) => Promise<Uint8Array>;

/** Lê o arquivo local como bytes via `expo-file-system` (mesmo idioma do SqlitePhotoStorage). */
const readWithFileSystem: FileReader = async (uri) => {
  const FileSystem = require('expo-file-system/legacy');
  const base64: string = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  return base64ToBytes(base64);
};

export interface SupabasePhotoStorageOptions {
  /** Armazenamento local (SQLite + conversão WebP): toda persistência local delega nele. */
  local: PhotoStorage;
  client: SupabaseClientLike;
  readFile?: FileReader;
}

/**
 * Decorator de `PhotoStorage` que envia as fotos ao bucket `animal-photos`
 * do Supabase Storage (doc §13 — padrão S3). O bucket é público para leitura
 * (anúncios são públicos, RF06) e a RLS só deixa o dono gravar na própria
 * pasta (§15.1/§15.3).
 *
 * Só aceita arquivos WebP já convertidos (o bucket recusa outros tipos);
 * `WebpPhotoStorage` garante isso na captura.
 */
export class SupabasePhotoStorage implements PhotoStorage {
  private local: PhotoStorage;
  private client: SupabaseClientLike;
  private readFile: FileReader;

  constructor(options: SupabasePhotoStorageOptions) {
    this.local = options.local;
    this.client = options.client;
    this.readFile = options.readFile ?? readWithFileSystem;
  }

  persistLocal(photo: AnimalPhoto): Promise<AnimalPhoto> {
    return this.local.persistLocal(photo);
  }

  listPendingUpload(): Promise<AnimalPhoto[]> {
    return this.local.listPendingUpload();
  }

  async uploadPending(photo: AnimalPhoto): Promise<AnimalPhoto> {
    if (photo.remoteUrl) return photo; // já enviada: reenvio é idempotente

    const localPath = photo.localPath;
    if (!localPath) {
      throw new PhotoUploadError('A foto não tem arquivo local para enviar.');
    }
    if (!/\.webp(\?.*)?$/i.test(localPath)) {
      throw new PhotoUploadError('A foto precisa estar em WebP antes do envio.');
    }

    const { data: sessionData, error: sessionError } = await this.client.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (sessionError || !userId) {
      throw new PhotoUploadError('Faça login para enviar fotos ao servidor.');
    }

    const path = photoObjectPath(userId, photo.animalId, photo.id);
    let bytes: Uint8Array;
    try {
      bytes = await this.readFile(localPath);
    } catch {
      throw new PhotoUploadError('Não foi possível ler o arquivo da foto.');
    }

    const bucket = this.client.storage.from(PHOTO_BUCKET);
    let uploadError: { message: string } | null;
    try {
      ({ error: uploadError } = await bucket.upload(path, bytes, {
        contentType: PHOTO_CONTENT_TYPE,
        upsert: true, // reenvio após falha parcial sobrescreve o mesmo objeto
      }));
    } catch (err) {
      throw new PhotoUploadError(
        err instanceof Error ? `Falha no envio da foto: ${err.message}` : 'Falha no envio da foto.'
      );
    }
    if (uploadError) {
      throw new PhotoUploadError(`Falha no envio da foto: ${uploadError.message}`);
    }

    photo.markUploaded(bucket.getPublicUrl(path).data.publicUrl);
    // O armazenamento local registra a URL remota e o novo estado em `local_images`.
    return this.local.uploadPending(photo);
  }

  async remove(photoId: string): Promise<void> {
    // Remove só o registro local; objetos órfãos no bucket ficam para a rotina de limpeza (Passo 5).
    await this.local.remove(photoId);
  }
}
