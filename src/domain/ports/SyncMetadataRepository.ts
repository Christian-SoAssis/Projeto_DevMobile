import { SyncMetadata } from '../entities/SyncMetadata';

export interface SyncMetadataRepository {
  get(key: string): Promise<SyncMetadata | null>;
  save(metadata: SyncMetadata): Promise<void>;
}
