import { AnimalPhoto } from '../../domain/entities/AnimalPhoto';
import { PhotoStorage } from '../../domain/ports/PhotoStorage';
import { ImageProcessor } from '../../domain/ports/ImageProcessor';

/**
 * Decorator de `PhotoStorage` que torna a conversão para WebP obrigatória:
 * toda foto passa pelo `ImageProcessor` ANTES de ser copiada para o
 * armazenamento do app. Assim o arquivo local já é pequeno (RNF01) e o
 * upload (bucket aceita só `image/webp`) nunca recebe outro formato.
 *
 * Se a conversão falhar, `ImageConversionError` sobe ao chamador e nada é
 * gravado — a UI orienta a escolher outra imagem.
 */
export class WebpPhotoStorage implements PhotoStorage {
  constructor(private inner: PhotoStorage, private processor: ImageProcessor) {}

  async persistLocal(photo: AnimalPhoto): Promise<AnimalPhoto> {
    // Foto só-remota não tem arquivo local para converter.
    if (!photo.localPath) return this.inner.persistLocal(photo);

    const webpUri = await this.processor.toWebp(photo.localPath);
    const converted = new AnimalPhoto({
      id: photo.id,
      animalId: photo.animalId,
      localPath: webpUri,
      remoteUrl: photo.remoteUrl,
      syncState: photo.syncState,
      createdAt: photo.createdAt,
    });
    return this.inner.persistLocal(converted);
  }

  listPendingUpload(): Promise<AnimalPhoto[]> {
    return this.inner.listPendingUpload();
  }

  uploadPending(photo: AnimalPhoto): Promise<AnimalPhoto> {
    return this.inner.uploadPending(photo);
  }

  remove(photoId: string): Promise<void> {
    return this.inner.remove(photoId);
  }
}
