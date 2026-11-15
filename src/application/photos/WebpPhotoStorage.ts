import { AnimalPhoto } from '../../domain/entities/AnimalPhoto';
import { PhotoStorage } from '../../domain/ports/PhotoStorage';
import { ImageProcessor } from '../../domain/ports/ImageProcessor';

/**
 * Decorator de `PhotoStorage` que converte fotos locais para WebP antes de persistir
 * (MID-01, DAT-08).
 */
export class WebpPhotoStorage implements PhotoStorage {
  constructor(private inner: PhotoStorage, private processor: ImageProcessor) {}

  async persistLocal(photo: AnimalPhoto): Promise<AnimalPhoto> {
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
