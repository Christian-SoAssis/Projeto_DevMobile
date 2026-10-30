import { SyncMetadata } from '../entities/SyncMetadata';

export interface SyncMetadataRepository {
  findByKey(key: string): Promise<SyncMetadata | null>;
  save(metadata: SyncMetadata): Promise<void>;
}
