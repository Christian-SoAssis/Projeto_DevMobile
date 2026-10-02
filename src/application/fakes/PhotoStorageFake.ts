import { AnimalPhoto } from '../../domain/entities/AnimalPhoto';
import { PhotoStorage } from '../../domain/ports/PhotoStorage';

export class PhotoStorageFake implements PhotoStorage {
  public photos: Map<string, AnimalPhoto> = new Map();

  async persistLocal(photo: AnimalPhoto): Promise<void> {
    this.photos.set(photo.id, photo);
  }

  async listPendingUpload(): Promise<AnimalPhoto[]> {
    return Array.from(this.photos.values()).filter(
      (p) => p.syncState.isPending() || p.syncState.isFailed()
    );
  }

  async uploadPending(photo: AnimalPhoto): Promise<AnimalPhoto> {
    photo.markUploaded(`https://storage.fake/${photo.animalId}/${photo.id}.jpg`);
    this.photos.set(photo.id, photo);
    return photo;
  }

  async remove(photoId: string): Promise<void> {
    this.photos.delete(photoId);
  }
}
