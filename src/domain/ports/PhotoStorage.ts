import { AnimalPhoto } from '../entities/AnimalPhoto';

export interface PhotoStorage {
  persistLocal(photo: AnimalPhoto): Promise<AnimalPhoto>;
  listPendingUpload(): Promise<AnimalPhoto[]>;
  uploadPending(photo: AnimalPhoto): Promise<AnimalPhoto>;
  remove(photoId: string): Promise<void>;
}
