import { Animal } from '../entities/Animal';

/**
 * Posição no fluxo de mudanças do servidor (OFF-06 — pull incremental,
 * decisão da ordem 6). Keyset `(at, id)`: `at` é o carimbo do SERVIDOR
 * (`updated_at`/`removed_at`) exatamente como veio — nunca o relógio do
 * aparelho — e `id` desempata linhas com o mesmo carimbo.
 */
export interface ChangeCursor {
  at: string;
  id: string;
}

export interface RemoteAnimalPage {
  /** Anúncios visíveis alterados DEPOIS do cursor, em ordem (at, id) crescente. */
  animals: Animal[];
  /** Cursor da última linha da página; `null` se a página veio vazia. */
  next: ChangeCursor | null;
}

/** Motivo de um anúncio ter saído da leitura pública. */
export type RemovalReason = 'DELETED' | 'HIDDEN';

export interface RemoteRemoval {
  animalId: string;
  reason: RemovalReason;
}

export interface RemoteRemovalPage {
  removals: RemoteRemoval[];
  next: ChangeCursor | null;
}

/**
 * Leitura de anúncios no servidor (perna de "pull" da sincronização, doc §14.1).
 * Separado de `AnimalRepository` porque só existe com backend configurado.
 */
export interface RemoteAnimalSource {
  /**
   * Delta de anúncios visíveis (não ocultados pela moderação), com as fotos
   * já enviadas. `after = null` → desde o início (primeira sincronização).
   */
  listVisibleChangedAfter(after: ChangeCursor | null, limit: number): Promise<RemoteAnimalPage>;
  /**
   * Tombstones: anúncios apagados ou ocultados depois do cursor — um delta
   * de linhas alteradas nunca traria quem deixou de existir.
   */
  listRemovedAfter(after: ChangeCursor | null, limit: number): Promise<RemoteRemovalPage>;
  /** Versão atual de um anúncio no servidor, ou `null` se não existir mais. */
  findRemoteById(id: string): Promise<Animal | null>;
}
