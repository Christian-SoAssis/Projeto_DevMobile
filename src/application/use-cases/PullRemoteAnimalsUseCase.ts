import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { ChangeCursor, RemoteAnimalSource } from '../../domain/ports/RemoteAnimalSource';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { SyncMetadataRepository } from '../../domain/ports/SyncMetadataRepository';
import { Animal } from '../../domain/entities/Animal';
import { SyncMetadata } from '../../domain/entities/SyncMetadata';

export const ANIMALS_SYNC_KEY = 'animals';

/** Linhas por página do delta (keyset). */
export const PULL_PAGE_SIZE = 200;
/** Teto de páginas por ciclo: o resto continua do cursor no próximo pull. */
export const PULL_MAX_PAGES = 50;
/**
 * Janela de sobreposição ao retomar do cursor salvo. `updated_at = now()` é
 * o início da transação no Postgres: uma transação longa pode confirmar
 * uma linha com carimbo MENOR que outra já recebida. Recuar 60 s no início
 * de cada ciclo recolhe esses atrasados; a reconciliação por `version` torna
 * a releitura inofensiva (idempotente).
 */
export const PULL_OVERLAP_MS = 60_000;
/** Menor uuid — limite inferior do desempate por `id` no keyset. */
const MIN_ID = '00000000-0000-0000-0000-000000000000';

export interface PullResult {
  fetched: number;
  added: number;
  updated: number;
  /** Anúncios com mudança local pendente: nunca são sobrescritos pelo servidor. */
  skippedPending: number;
  /** Anúncios apagados/ocultados no servidor e retirados do cache local. */
  removed?: number;
}

export interface PullOptions {
  /**
   * Conta da sessão ativa: um anúncio PRÓPRIO ocultado pela moderação
   * continua no aparelho do dono (ele ainda o vê no servidor, RLS
   * `animals_select_owner`). Ausente → nenhum anúncio é tratado como próprio.
   */
  currentUserId?: () => string | null | undefined;
  pageSize?: number;
  maxPages?: number;
  overlapMs?: number;
}

/** Cursor persistido em `sync_state.cursor` (JSON opaco para o repositório). */
interface StoredCursors {
  animals?: ChangeCursor;
  removals?: ChangeCursor;
}

/**
 * Reconciliação "servidor → aparelho" (doc §14.1) por DELTA (OFF-06 —
 * decisão da ordem 6): só o que mudou depois do cursor salvo é baixado,
 * mais os tombstones (apagados/ocultados), que um delta de linhas
 * alteradas nunca traria. Sem cursor (1ª sincronização ou banco antigo),
 * baixa tudo uma vez.
 *
 * Regra de ouro (RNF02/RNF03, sem perda silenciosa): um anúncio com ação
 * pendente na fila NÃO é tocado — nem sobrescrito nem removido. A edição
 * local sobe primeiro e eventuais conflitos passam pelo fluxo de revisão.
 */
export class PullRemoteAnimalsUseCase {
  private pageSize: number;
  private maxPages: number;
  private overlapMs: number;

  constructor(
    private source: RemoteAnimalSource,
    private animalRepository: AnimalRepository,
    private syncQueueRepository: SyncQueueRepository,
    private metadataRepository?: SyncMetadataRepository,
    private now: () => string = () => new Date().toISOString(),
    private options: PullOptions = {}
  ) {
    this.pageSize = options.pageSize ?? PULL_PAGE_SIZE;
    this.maxPages = options.maxPages ?? PULL_MAX_PAGES;
    this.overlapMs = options.overlapMs ?? PULL_OVERLAP_MS;
  }

  async execute(): Promise<PullResult> {
    const startedAt = this.now();
    const metadata =
      (await this.metadataRepository?.findByKey(ANIMALS_SYNC_KEY)) ??
      new SyncMetadata({ key: ANIMALS_SYNC_KEY });
    metadata.markSynced(startedAt);
    const cursors = PullRemoteAnimalsUseCase.parseCursors(metadata.cursor);

    const pending = await this.syncQueueRepository.listPending();
    const dirty = new Set(pending.filter((a) => a.entityType === 'animal').map((a) => a.entityId));
    const result: PullResult = { fetched: 0, added: 0, updated: 0, skippedPending: 0, removed: 0 };

    // 1) Anúncios alterados — cada página é gravada antes da próxima, e o
    //    cursor só avança sobre o que já está no cache.
    let after = this.resumeFrom(cursors.animals);
    for (let page = 0; page < this.maxPages; page++) {
      const { animals, next } = await this.source.listVisibleChangedAfter(after, this.pageSize);
      result.fetched += animals.length;
      await this.reconcile(animals, dirty, result);
      if (next) {
        cursors.animals = PullRemoteAnimalsUseCase.maxCursor(cursors.animals, next);
        after = next;
      }
      if (animals.length < this.pageSize || !next) break;
    }

    // 2) Tombstones — depois dos alterados: um anúncio apagado/ocultado não
    //    volta a aparecer no delta enquanto estiver fora da leitura pública.
    const sessionUserId = this.options.currentUserId?.();
    let removedAfter = this.resumeFrom(cursors.removals);
    for (let page = 0; page < this.maxPages; page++) {
      const { removals, next } = await this.source.listRemovedAfter(removedAfter, this.pageSize);
      for (const removal of removals) {
        if (dirty.has(removal.animalId)) {
          result.skippedPending += 1;
          continue;
        }
        const local = await this.animalRepository.findById(removal.animalId);
        if (!local) continue;
        if (removal.reason === 'HIDDEN' && sessionUserId && local.ownerId === sessionUserId) {
          continue; // o dono ainda enxerga o próprio anúncio ocultado
        }
        await this.animalRepository.deleteLocal(removal.animalId);
        result.removed = (result.removed ?? 0) + 1;
      }
      if (next) {
        cursors.removals = PullRemoteAnimalsUseCase.maxCursor(cursors.removals, next);
        removedAfter = next;
      }
      if (removals.length < this.pageSize || !next) break;
    }

    // `last_sync_at`/cursor só avançam quando a leitura inteira deu certo
    // (doc §14.1 passo 10). O cursor é o carimbo do SERVIDOR da última
    // linha recebida — nunca o relógio do aparelho.
    metadata.setCursor(JSON.stringify(cursors));
    metadata.markSuccess(startedAt);
    await this.metadataRepository?.save(metadata);
    return result;
  }

  private async reconcile(remote: Animal[], dirty: Set<string>, result: PullResult): Promise<void> {
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
  }

  /** Retoma do cursor salvo menos a janela de sobreposição; sem cursor, desde o início. */
  private resumeFrom(saved?: ChangeCursor): ChangeCursor | null {
    if (!saved) return null;
    const at = Date.parse(saved.at);
    if (Number.isNaN(at)) return null; // cursor ilegível → recomeça do zero (seguro)
    return { at: new Date(at - this.overlapMs).toISOString(), id: MIN_ID };
  }

  private isNewer(incoming: Animal, local: Animal): boolean {
    if (incoming.version !== local.version) return incoming.version > local.version;
    return new Date(incoming.updatedAt).getTime() > new Date(local.updatedAt).getTime();
  }

  /** O cursor nunca recua: a janela de sobreposição releria linhas já vistas. */
  private static maxCursor(current: ChangeCursor | undefined, candidate: ChangeCursor): ChangeCursor {
    if (!current) return candidate;
    const a = Date.parse(current.at);
    const b = Date.parse(candidate.at);
    if (b > a) return candidate;
    if (b < a) return current;
    // Mesmo milissegundo: compara a string crua (microssegundos do Postgres) e o id.
    if (candidate.at !== current.at) return candidate.at > current.at ? candidate : current;
    return candidate.id > current.id ? candidate : current;
  }

  private static parseCursors(raw?: string): StoredCursors {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as StoredCursors;
      const valid = (c?: ChangeCursor) =>
        c && typeof c.at === 'string' && typeof c.id === 'string' ? c : undefined;
      return { animals: valid(parsed?.animals), removals: valid(parsed?.removals) };
    } catch {
      return {};
    }
  }
}
