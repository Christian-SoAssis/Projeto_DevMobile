import { AnimalPhoto } from '../entities/AnimalPhoto';

/**
 * Port de armazenamento de fotos de anúncios.
 *
 * Espelha o vínculo foto ↔ anúncio da documentação (§4.2: `AnimalPhoto`
 * persistida no SQLite pelo caminho local e no remoto via `animal_photos` +
 * Storage) e o fluxo de upload pendente → reconciliação (§9.2, §14.1 passos
 * 5–6). Implementações concretas (SQLite local, Supabase Storage remoto)
 * vivem na infraestrutura e são ligadas apenas nas Fases 2–3.
 */
export interface PhotoStorage {
  persistLocal(photo: AnimalPhoto): Promise<void>;
  listPendingUpload(): Promise<AnimalPhoto[]>;
  uploadPending(photo: AnimalPhoto): Promise<AnimalPhoto>;
  remove(photoId: string): Promise<void>;
}
