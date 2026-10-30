import { SyncMetadata } from '../../domain/entities/SyncMetadata';
import { SyncMetadataRepository } from '../../domain/ports/SyncMetadataRepository';

export class SyncMetadataRepositoryFake implements SyncMetadataRepository {
  public readonly items = new Map<string, SyncMetadata>();

  async findByKey(key: string): Promise<SyncMetadata | null> {
    return this.items.get(key) || null;
  }

  async save(metadata: SyncMetadata): Promise<void> {
    this.items.set(metadata.key, metadata);
  }
}
