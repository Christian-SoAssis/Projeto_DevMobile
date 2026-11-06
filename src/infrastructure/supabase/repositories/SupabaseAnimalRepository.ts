import {
  AnimalRepository,
  AnimalFilterOptions,
} from '../../../domain/ports/AnimalRepository';
import { Animal } from '../../../domain/entities/Animal';
import { AnimalPhoto } from '../../../domain/entities/AnimalPhoto';
import { PhotoStorage } from '../../../domain/ports/PhotoStorage';
import {
  ChangeCursor,
  RemoteAnimalPage,
  RemoteAnimalSource,
  RemoteRemovalPage,
} from '../../../domain/ports/RemoteAnimalSource';
import {
  AnimalCharacteristics,
} from '../../../domain/value-objects/AnimalCharacteristics';
import {
  ApproximateLocation,
} from '../../../domain/value-objects/ApproximateLocation';
import { AdoptionStatus } from '../../../domain/value-objects/AdoptionStatus';
import { SupabaseClientLike, AnimalRow, AnimalPhotoRow, AnimalTombstoneRow } from '../types';
import { PHOTO_BUCKET } from '../storage/SupabasePhotoStorage';

/** Código do Postgres para violação de unicidade (PK/unique) — reenvio idempotente. */
const UNIQUE_VIOLATION = '23505';

export class StaleVersionError extends Error {
  constructor(message = 'Atualização remota rejeitada: versão defasada, registro ausente ou bloqueada pela RLS.') {
    super(message);
    this.name = 'StaleVersionError';
  }
}

export class RemoteSupabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RemoteSupabaseError';
  }
}

export interface SupabaseAnimalRepositoryOptions {
  /** Repositório local (SQLite) — todos os métodos locais delegam nele. */
  local: AnimalRepository;
  client: SupabaseClientLike;
  /**
   * Upload das fotos ainda só locais. Com ele, a criação/edição ONLINE também
   * sobe as imagens antes de gravar o anúncio (sem ele só a fila sobe).
   */
  photoUploader?: PhotoStorage;
}

/**
 * Decorator `AnimalRepository` que mantém tudo local no SQLite e envia as
 * mutações ao Supabase (doc §13/§14). Um use case continua vendo **um único
 * port** — `ProcessSyncQueueUseCase` chama `createRemote/updateRemote/
 * deleteRemote` e passa a falar com o backend real, sem mudanças na aplicação.
 *
 * Segurança em profundidade (§15.3): a validação de propriedade já passou no
 * use case e no domínio; aqui o RLS do Postgres rejeita de novo — e o bloqueio
 * otimista por `version` (doc §14.3) rejeita `UPDATE` feitos com versão antiga.
 */
export class SupabaseAnimalRepository implements AnimalRepository, RemoteAnimalSource {
  private local: AnimalRepository;
  private client: SupabaseClientLike;
  private photoUploader?: PhotoStorage;

  constructor(options: SupabaseAnimalRepositoryOptions) {
    this.local = options.local;
    this.client = options.client;
    this.photoUploader = options.photoUploader;
  }

  // ---------------------------------------------------------------------------
  // Métodos de verdade local → proxy para o SQLite (offline-first)
  // ---------------------------------------------------------------------------
  findById(id: string): Promise<Animal | null> {
    return this.local.findById(id);
  }

  search(filters: AnimalFilterOptions): Promise<Animal[]> {
    return this.local.search(filters);
  }

  saveLocal(animal: Animal): Promise<void> {
    return this.local.saveLocal(animal);
  }

  deleteLocal(id: string): Promise<void> {
    return this.local.deleteLocal(id);
  }

  listByOwner(ownerId: string): Promise<Animal[]> {
    return this.local.listByOwner(ownerId);
  }

  upsertCache(animals: Animal[]): Promise<void> {
    return this.local.upsertCache(animals);
  }

  // ---------------------------------------------------------------------------
  // Métodos remotos → Supabase
  // ---------------------------------------------------------------------------
  async createRemote(animal: Animal): Promise<Animal> {
    await this.uploadPendingPhotos(animal);
    const { data, error } = await this.client
      .from<AnimalRow>('animals')
      .insert(this.toInsertPayload(animal))
      .select();

    if (error) {
      // OFF-05/DAT-08 (cenário T04): confirmação perdida após o servidor
      // gravar → o reenvio da mesma ação CREATE chega como violação de
      // unicidade. O id local é ESTÁVEL (UUID compartilhado), então só é
      // sucesso se a linha conflitante for o próprio anúncio — a re-leitura
      // pela RLS devolve vazia para linha de terceiro (defesa em
      // profundidade: erro de verdade, sem acesso indevido).
      if (error.code === UNIQUE_VIOLATION) {
        const reused = await this.findByRemoteId(animal.id);
        if (reused && reused.owner_id === animal.ownerId) {
          await this.syncPhotos(animal);
          return SupabaseAnimalRepository.rowToAnimal(reused);
        }
      }
      throw new RemoteSupabaseError(`Falha ao criar o anúncio remotamente: ${error.message}`);
    }
    const row = (data ?? [])[0];
    if (!row) throw new RemoteSupabaseError('Criação remota não retornou o registro do anúncio.');
    await this.syncPhotos(animal);
    return SupabaseAnimalRepository.rowToAnimal(row);
  }

  /** Leitura remota por id — só devolve o que a RLS deixa ver (público/dono/admin). */
  private async findByRemoteId(id: string): Promise<AnimalRow | null> {
    const { data, error } = await this.client
      .from<AnimalRow>('animals')
      .select()
      .eq('id', id);
    if (error) return null;
    return (data ?? [])[0] ?? null;
  }

  async updateRemote(animal: Animal): Promise<Animal> {
    await this.uploadPendingPhotos(animal);
    const { data, error } = await this.client
      .from<AnimalRow>('animals')
      .update(this.toUpdatePayload(animal))
      /**
       * Bloqueio otimista (doc §14.3). A edição local já incrementou a
       * `version` da entidade (`touch()`); o servidor, porém, ainda guarda a
       * versão PRÉ-edição (`animal.version - 1`). Realizamos o `UPDATE`
       * casando essa versão esperada — se o servidor avançou (edição remota
       * concorrente), zero linhas batem → `StaleVersionError` e a ação da fila
       * permanece para revisão (sem perda silenciosa, RF23). Pela RLS
       * (§15.3), uma edição de terceiro também devolve zero linhas — o
       * cliente não distingue as duas causas, que é a propriedade de
       * defesa em profundidade: nenhuma informação é vazada.
       */
      .eq('id', animal.id)
      .eq('version', animal.version - 1)
      .select();

    if (error) {
      throw new RemoteSupabaseError(`Falha ao atualizar o anúncio remotamente: ${error.message}`);
    }
    const rows = data ?? [];
    if (rows.length === 0) {
      throw new StaleVersionError();
    }
    await this.syncPhotos(animal);
    return SupabaseAnimalRepository.rowToAnimal(rows[0]);
  }

  /** Sobe as fotos locais sem URL remota (antes do anúncio, doc §14.1) e guarda a URL no cache. */
  private async uploadPendingPhotos(animal: Animal): Promise<void> {
    if (!this.photoUploader) return;
    let uploadedAny = false;
    for (const photo of animal.photos) {
      if (photo.remoteUrl || !photo.localPath) continue;
      await this.photoUploader.uploadPending(photo);
      uploadedAny = true;
    }
    if (uploadedAny) await this.local.saveLocal(animal);
  }

  /**
   * Registra em `animal_photos` as fotos já enviadas ao Storage (com
   * `remote_url`). Fotos ainda só locais não vão: o servidor nunca aponta
   * para um arquivo que não existe. Apaga-e-regrava para ser idempotente em
   * reenvios da fila (a RLS restringe ao dono do anúncio).
   */
  private async syncPhotos(animal: Animal): Promise<void> {
    const uploaded = animal.photos.filter((p) => !!p.remoteUrl);
    // Fotos que saíram do anúncio (troca na edição): apaga os arquivos órfãos do bucket.
    await this.removeObjectsOfPhotos(animal.id, new Set(uploaded.map((p) => p.id)));
    const del = await this.client.from<AnimalPhotoRow>('animal_photos').delete().eq('animal_id', animal.id);
    if (del.error) {
      throw new RemoteSupabaseError(`Falha ao atualizar as fotos do anúncio: ${del.error.message}`);
    }
    if (uploaded.length === 0) return;
    const rows: Array<Partial<AnimalPhotoRow>> = uploaded.map((p, index) => ({
      id: p.id,
      animal_id: animal.id,
      remote_url: p.remoteUrl,
      is_main: index === 0,
      upload_status: 'SYNCED',
      created_at: p.createdAt,
    }));
    const ins = await this.client.from<AnimalPhotoRow>('animal_photos').insert(rows);
    if (ins.error) {
      throw new RemoteSupabaseError(`Falha ao registrar as fotos do anúncio: ${ins.error.message}`);
    }
  }

  /**
   * Remove do bucket os arquivos das fotos do anúncio que NÃO estão em `keep`.
   * Best-effort: uma falha aqui deixa arquivo órfão, mas nunca impede a
   * operação principal (a RLS só deixa o dono apagar na própria pasta).
   */
  private async removeObjectsOfPhotos(animalId: string, keep: Set<string> = new Set()): Promise<void> {
    try {
      const { data } = await this.client
        .from<AnimalPhotoRow>('animal_photos')
        .select('*')
        .eq('animal_id', animalId);
      const marker = `/${PHOTO_BUCKET}/`;
      const paths = (data ?? [])
        .filter((row) => !keep.has(row.id) && row.remote_url && row.remote_url.includes(marker))
        .map((row) => decodeURIComponent((row.remote_url as string).split(marker)[1].split('?')[0]));
      if (paths.length > 0) {
        await this.client.storage.from(PHOTO_BUCKET).remove(paths);
      }
    } catch {
      // Arquivo órfão é aceitável; limpeza futura.
    }
  }

  async deleteRemote(id: string): Promise<void> {
    await this.removeObjectsOfPhotos(id);
    // DELETE é idempotente: registro já ausente (ou bloqueado por RLS, teoricamente
    // impossível — o dono é quem envia) devolve zero linhas e NÃO é erro.
    const { error } = await this.client.from<AnimalRow>('animals').delete().eq('id', id);
    if (error) {
      throw new RemoteSupabaseError(`Falha ao excluir o anúncio remotamente: ${error.message}`);
    }
  }

  /**
   * Leitura pública de anúncios visíveis (§15.1: `READ` para anon via RLS
   * `animals_read_public`). Usada pela reconciliação (Passo 5) e refletida
   * aqui para teste unitário antes de credenciais reais existirem.
   */
  async listPublicRemote(filters: AnimalFilterOptions = {}): Promise<Animal[]> {
    let query = this.client
      .from<AnimalRow>('animals')
      .select('*')
      .eq('moderation_status', 'NONE')
      .eq('status', filters.status && filters.status !== 'AVAILABLE' ? filters.status : 'AVAILABLE');

    if (filters.species) query = query.eq('species', filters.species);

    const { data, error } = await query.limit(100);
    if (error) {
      throw new RemoteSupabaseError(`Falha na leitura pública de anúncios: ${error.message}`);
    }
    return (data ?? []).map((row) => SupabaseAnimalRepository.rowToAnimal(row));
  }

  /**
   * Delta de anúncios visíveis (OFF-06, ordem 6), em keyset `(updated_at, id)`
   * crescente: só o que mudou DEPOIS do cursor, com as fotos já enviadas —
   * insumo da reconciliação local (doc §14.1). A RLS `animals_read_public`
   * já esconde os ocultados de quem não é dono; o filtro explícito mantém
   * o dono/admin no mesmo corte público (ocultados chegam como tombstone).
   */
  async listVisibleChangedAfter(after: ChangeCursor | null, limit: number): Promise<RemoteAnimalPage> {
    let query = this.client
      .from<AnimalRow>('animals')
      .select('*')
      .eq('moderation_status', 'NONE');
    if (after) query = query.or(SupabaseAnimalRepository.keysetAfter('updated_at', 'id', after));
    const { data, error } = await query
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(limit);
    if (error) {
      throw new RemoteSupabaseError(`Falha ao ler anúncios do servidor: ${error.message}`);
    }
    const rows = data ?? [];
    const photos = await this.loadRemotePhotos(rows.map((r) => r.id));
    const last = rows[rows.length - 1];
    return {
      animals: rows.map((row) => SupabaseAnimalRepository.rowToAnimal(row, photos.get(row.id) ?? [])),
      next: last ? { at: last.updated_at, id: last.id } : null,
    };
  }

  /** Tombstones (apagados/ocultados) depois do cursor, em keyset `(removed_at, animal_id)`. */
  async listRemovedAfter(after: ChangeCursor | null, limit: number): Promise<RemoteRemovalPage> {
    let query = this.client.from<AnimalTombstoneRow>('animal_tombstones').select('*');
    if (after) query = query.or(SupabaseAnimalRepository.keysetAfter('removed_at', 'animal_id', after));
    const { data, error } = await query
      .order('removed_at', { ascending: true })
      .order('animal_id', { ascending: true })
      .limit(limit);
    if (error) {
      throw new RemoteSupabaseError(`Falha ao ler anúncios removidos do servidor: ${error.message}`);
    }
    const rows = data ?? [];
    const last = rows[rows.length - 1];
    return {
      removals: rows.map((row) => ({
        animalId: row.animal_id,
        reason: row.reason === 'HIDDEN' ? 'HIDDEN' : 'DELETED',
      })),
      next: last ? { at: last.removed_at, id: last.animal_id } : null,
    };
  }

  /**
   * `(ts, id) > (cursor.at, cursor.id)` em sintaxe PostgREST. Valores entre
   * aspas: o carimbo traz `:`/`.`/`+` (reservados no `or=`). O carimbo é
   * repassado CRU (microssegundos do Postgres) — truncar para milissegundos
   * faria o `gt` reler a mesma página para sempre.
   */
  static keysetAfter(tsColumn: string, idColumn: string, after: ChangeCursor): string {
    const at = `"${after.at.replace(/"/g, '')}"`;
    const id = `"${after.id.replace(/"/g, '')}"`;
    return `${tsColumn}.gt.${at},and(${tsColumn}.eq.${at},${idColumn}.gt.${id})`;
  }

  async findRemoteById(id: string): Promise<Animal | null> {
    const { data, error } = await this.client.from<AnimalRow>('animals').select('*').eq('id', id);
    if (error) {
      throw new RemoteSupabaseError(`Falha ao ler o anúncio no servidor: ${error.message}`);
    }
    const row = (data ?? [])[0];
    if (!row) return null;
    const photos = await this.loadRemotePhotos([row.id]);
    return SupabaseAnimalRepository.rowToAnimal(row, photos.get(row.id) ?? []);
  }

  private async loadRemotePhotos(animalIds: string[]): Promise<Map<string, AnimalPhoto[]>> {
    const byAnimal = new Map<string, AnimalPhoto[]>();
    if (animalIds.length === 0) return byAnimal;
    const { data, error } = await this.client
      .from<AnimalPhotoRow>('animal_photos')
      .select('*')
      .in('animal_id', animalIds);
    if (error) {
      throw new RemoteSupabaseError(`Falha ao ler as fotos dos anúncios: ${error.message}`);
    }
    const rows = [...(data ?? [])].sort((a, b) => Number(b.is_main) - Number(a.is_main));
    for (const row of rows) {
      if (!row.remote_url) continue;
      const list = byAnimal.get(row.animal_id) ?? [];
      list.push(
        new AnimalPhoto({
          id: row.id,
          animalId: row.animal_id,
          remoteUrl: row.remote_url,
          createdAt: row.created_at,
        })
      );
      byAnimal.set(row.animal_id, list);
    }
    return byAnimal;
  }

  // ---------------------------------------------------------------------------
  // Mapeamento domínio ↔ linha (`animals` no Supabase, mesmo corte do SQLite)
  // ---------------------------------------------------------------------------
  private toInsertPayload(animal: Animal): Partial<AnimalRow> & Record<string, unknown> {
    return {
      // O Postgres gerar uuid; aqui mantemos o id local p/ outbox casar.
      id: animal.id,
      owner_id: animal.ownerId,
      name: animal.name,
      species: animal.characteristics.species,
      size: animal.characteristics.size,
      approximate_age: animal.characteristics.approximateAge,
      sex: animal.characteristics.sex,
      description: animal.characteristics.characteristics || null,
      health_notes: animal.characteristics.behavior || null,
      special_care: animal.characteristics.specialCare || null,
      status: animal.status.value,
      neighborhood: animal.location.neighborhood,
      city: animal.location.city,
      region: animal.location.region,
      latitude: animal.location.latitude,
      longitude: animal.location.longitude,
      created_at: animal.createdAt,
      updated_at: animal.updatedAt,
      version: animal.version,
    };
  }

  private toUpdatePayload(animal: Animal): Partial<AnimalRow> {
    return {
      name: animal.name,
      species: animal.characteristics.species,
      size: animal.characteristics.size,
      approximate_age: animal.characteristics.approximateAge,
      sex: animal.characteristics.sex,
      description: animal.characteristics.characteristics || null,
      health_notes: animal.characteristics.behavior || null,
      special_care: animal.characteristics.specialCare || null,
      status: animal.status.value,
      neighborhood: animal.location.neighborhood,
      city: animal.location.city,
      region: animal.location.region,
      latitude: animal.location.latitude,
      longitude: animal.location.longitude,
      version: animal.version,
    };
  }

  static rowToAnimal(row: AnimalRow, photos: AnimalPhoto[] = []): Animal {
    const characteristics = new AnimalCharacteristics({
      species: row.species,
      size: row.size,
      approximateAge: row.approximate_age,
      sex: row.sex,
      characteristics: row.description || undefined,
      behavior: row.health_notes || undefined,
      specialCare: row.special_care || undefined,
    });
    const location = new ApproximateLocation({
      latitude: row.latitude,
      longitude: row.longitude,
      neighborhood: row.neighborhood,
      city: row.city,
      region: row.region,
      timestamp: row.updated_at,
    });
    return new Animal({
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      characteristics,
      status: new AdoptionStatus(row.status as 'AVAILABLE' | 'ADOPTED'),
      location,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      version: row.version,
      photos,
    });
  }
}
