import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { RemoteAnimalSource } from '../../domain/ports/RemoteAnimalSource';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { SyncMetadataRepository } from '../../domain/ports/SyncMetadataRepository';
import { Animal } from '../../domain/entities/Animal';
import { SyncMetadata } from '../../domain/entities/SyncMetadata';

export const ANIMALS_SYNC_KEY = 'animals';

export interface PullResult {
  fetched: number;
  added: number;
  updated: number;
  /** Anúncios com mudança local pendente: nunca são sobrescritos pelo servidor. */
  skippedPending: number;
}

/**
 * Reconciliação "servidor → aparelho" (doc §14.1): traz os anúncios visíveis
 * para o cache local, para que o app mostre anúncios de outras pessoas.
 *
 * Regra de ouro (RNF02/RNF03, sem perda silenciosa): um anúncio com ação
 * pendente na fila NÃO é tocado — a edição local sobe primeiro e eventuais
 * conflitos passam pelo fluxo de revisão.
 */
export class PullRemoteAnimalsUseCase {
  constructor(
    private source: RemoteAnimalSource,
    private animalRepository: AnimalRepository,
    private syncQueueRepository: SyncQueueRepository,
    private metadataRepository?: SyncMetadataRepository,
    private now: () => string = () => new Date().toISOString()
  ) {}

  async execute(): Promise<PullResult> {
    const startedAt = this.now();
    const metadata =
      (await this.metadataRepository?.findByKey(ANIMALS_SYNC_KEY)) ??
      new SyncMetadata({ key: ANIMALS_SYNC_KEY });
    metadata.markSynced(startedAt);

    const remote = await this.source.listVisibleRemote();
    const pending = await this.syncQueueRepository.listPending();
    const dirty = new Set(pending.filter((a) => a.entityType === 'animal').map((a) => a.entityId));

    const result: PullResult = { fetched: remote.length, added: 0, updated: 0, skippedPending: 0 };
    const toSave: Animal[] = [];

    for (const incoming of remote) {
      if (dirty.has(incoming.id)) {
        result.skippedPending += 1;
        continue;
      }
      const local = await this.animalRepository.findById(incoming.id);
      if (!local) {
        toSave.push(incoming);
        result.added += 1;
      } else if (this.isNewer(incoming, local)) {
        toSave.push(incoming);
        result.updated += 1;
      }
    }

    if (toSave.length > 0) {
      await this.animalRepository.upsertCache(toSave);
    }

    // `last_sync_at` só avança quando a leitura inteira deu certo (doc §14.1 passo 10).
    metadata.markSuccess(startedAt);
    await this.metadataRepository?.save(metadata);
    return result;
  }

  private isNewer(incoming: Animal, local: Animal): boolean {
    if (incoming.version !== local.version) return incoming.version > local.version;
    return new Date(incoming.updatedAt).getTime() > new Date(local.updatedAt).getTime();
  }
}
