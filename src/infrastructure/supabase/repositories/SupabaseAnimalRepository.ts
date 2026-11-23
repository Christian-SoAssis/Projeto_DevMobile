import { Animal } from '../../../domain/entities/Animal';
import { AnimalPhoto } from '../../../domain/entities/AnimalPhoto';
import { AdoptionStatus, AdoptionStatusType } from '../../../domain/value-objects/AdoptionStatus';
import { AnimalCharacteristics } from '../../../domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../../domain/value-objects/ApproximateLocation';
import { SyncState } from '../../../domain/value-objects/SyncState';
import {
  DeltaCursor,
  DeltaPage,
  RemoteAnimalSource,
  TombstonePage,
} from '../../../domain/ports/RemoteAnimalSource';
import { SupabaseClientLike } from '../types';
import {
  extractBucketObjectPath,
  PHOTO_BUCKET,
} from '../storage/SupabasePhotoStorage';

interface RemoteAnimalRow {
  id: string;
  owner_id: string;
  name: string;
  species: string;
  size: string;
  approximate_age: string;
  sex: string;
  description: string | null;
  health_notes: string | null;
  special_care: string | null;
  status: string;
  neighborhood: string | null;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  moderation_status: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  animal_photos?: Array<{
    id: string;
    animal_id: string;
    local_path: string | null;
    remote_url: string | null;
    is_main: boolean | null;
    upload_status: string | null;
    created_at: string;
  }>;
}

/**
 * Repositório remoto de anúncios integrado às tabelas `public.animals`,
 * `public.animal_photos` e `public.animal_tombstones` do Supabase.
 */
export class SupabaseAnimalRepository implements RemoteAnimalSource {
  constructor(private client: SupabaseClientLike) {}

  async listVisibleChangedAfter(
    cursor: DeltaCursor | null,
    limit: number = 100
  ): Promise<DeltaPage> {
    let query = this.client
      .from('animals')
      .select('*, animal_photos(*)')
      .neq('moderation_status', 'HIDDEN')
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(limit);

    if (cursor) {
      query = query.gte('updated_at', cursor.updatedAt);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Falha ao consultar anúncios no Supabase: ${error.message}`);
    }

    const rows = (data ?? []) as RemoteAnimalRow[];
    const filtered = cursor
      ? rows.filter(
          (r) =>
            r.updated_at > cursor.updatedAt ||
            (r.updated_at === cursor.updatedAt && r.id > cursor.id)
        )
      : rows;

    const animals = filtered.map((r) => this.mapRowToEntity(r));
    const last = filtered[filtered.length - 1];

    return {
      animals,
      nextCursor: last ? { updatedAt: last.updated_at, id: last.id } : null,
    };
  }

  async listTombstonesAfter(
    cursor: DeltaCursor | null,
    limit: number = 100
  ): Promise<TombstonePage> {
    let query = this.client
      .from('animal_tombstones')
      .select('*')
      .order('removed_at', { ascending: true })
      .order('animal_id', { ascending: true })
      .limit(limit);

    if (cursor) {
      query = query.gt('removed_at', cursor.updatedAt);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Falha ao consultar tombstones no Supabase: ${error.message}`);
    }

    const rows = (data ?? []) as Array<{
      animal_id: string;
      reason: 'DELETED' | 'HIDDEN';
      removed_at: string;
    }>;
    const last = rows[rows.length - 1];

    return {
      tombstones: rows.map((r) => ({
        animalId: r.animal_id,
        reason: r.reason,
        deletedAt: r.removed_at,
      })),
      nextCursor: last ? { updatedAt: last.removed_at, id: last.animal_id } : null,
    };
  }

  async findById(id: string): Promise<Animal | null> {
    const { data, error } = await this.client
      .from('animals')
      .select('*, animal_photos(*)')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapRowToEntity(data as RemoteAnimalRow);
  }

  async createRemote(animal: Animal): Promise<Animal> {
    const rowPayload = this.toRemoteRow(animal);

    const { data, error } = await this.client
      .from('animals')
      .upsert(rowPayload, { onConflict: 'id' })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Não foi possível publicar o anúncio no Supabase.');
    }

    await this.syncRemotePhotos(animal);
    return (await this.findById(animal.id)) ?? animal;
  }

  async updateRemote(animal: Animal, expectedVersion?: number): Promise<Animal> {
    if (expectedVersion !== undefined) {
      const existing = await this.findById(animal.id);
      if (existing && existing.version > expectedVersion) {
        throw new Error(
          `CONFLICT_VERSION: versão remota (${existing.version}) diverge da esperada (${expectedVersion}).`
        );
      }
    }

    const rowPayload = this.toRemoteRow(animal);

    const { data, error } = await this.client
      .from('animals')
      .upsert(rowPayload, { onConflict: 'id' })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Não foi possível atualizar o anúncio no Supabase.');
    }

    await this.syncRemotePhotos(animal);
    return (await this.findById(animal.id)) ?? animal;
  }

  async deleteRemote(animalId: string): Promise<void> {
    // Remove fotos do bucket antes de excluir o anúncio para evitar objetos órfãos (DAT-12)
    try {
      const existing = await this.findById(animalId);
      if (existing && existing.photos.length > 0) {
        const paths = existing.photos
          .map((p) => extractBucketObjectPath(p.remoteUrl))
          .filter((p): p is string => Boolean(p));
        await this.removeBucketPaths(paths);
      }
    } catch {
      // prossegue com exclusão do registro
    }

    const { error } = await this.client.from('animals').delete().eq('id', animalId);
    if (error) {
      throw new Error(`Falha ao excluir anúncio no Supabase: ${error.message}`);
    }
  }

  private async syncRemotePhotos(animal: Animal): Promise<void> {
    // 1. Consulta fotos remotas atuais para remover do bucket quaisquer fotos descartadas na edição
    const currentPhotoIds = new Set(animal.photos.map((p) => p.id));
    try {
      const existing = await this.findById(animal.id);
      if (existing) {
        const orphanedPaths = existing.photos
          .filter((p) => !currentPhotoIds.has(p.id))
          .map((p) => extractBucketObjectPath(p.remoteUrl))
          .filter((p): p is string => Boolean(p));
        await this.removeBucketPaths(orphanedPaths);
      }
    } catch {
      // ignora falha de limpeza prévia
    }

    await this.client.from('animal_photos').delete().eq('animal_id', animal.id);

    // 2. Só grava na tabela remota fotos que já subiram para o bucket (remoteUrl http/https válida)
    const uploadedPhotos = animal.photos.filter((p) =>
      Boolean(p.remoteUrl && /^https?:\/\//i.test(p.remoteUrl))
    );
    if (uploadedPhotos.length === 0) return;

    const rows = uploadedPhotos.map((p, idx) => ({
      id: p.id,
      animal_id: animal.id,
      local_path: null,
      remote_url: p.remoteUrl!,
      is_main: idx === 0,
      upload_status: 'SYNCED',
      created_at: p.createdAt,
    }));

    const { error } = await this.client.from('animal_photos').insert(rows);
    if (error && !/duplicate/i.test(error.message || '')) {
      throw new Error(`Falha ao registrar fotos no Supabase: ${error.message}`);
    }
  }

  private async removeBucketPaths(paths: string[]): Promise<void> {
    if (paths.length === 0 || !this.client.storage) return;
    try {
      const bucket = this.client.storage.from(PHOTO_BUCKET) as any;
      if (typeof bucket?.remove === 'function') {
        await bucket.remove(paths);
      }
    } catch {
      // ignora erro de remoção de storage
    }
  }

  private toRemoteRow(animal: Animal): Record<string, unknown> {
    return {
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
      moderation_status: animal.hidden ? 'HIDDEN' : 'NONE',
      version: animal.version,
    };
  }

  public mapRowToEntity(row: RemoteAnimalRow): Animal {
    const rawPhotos = Array.isArray(row.animal_photos) ? [...row.animal_photos] : [];
    rawPhotos.sort((a, b) => (a.is_main === b.is_main ? 0 : a.is_main ? -1 : 1));

    const photos = rawPhotos
      .filter((p) => Boolean(p.remote_url))
      .slice(0, 4)
      .map(
        (p) =>
          new AnimalPhoto({
            id: p.id,
            animalId: row.id,
            localPath: undefined,
            remoteUrl: p.remote_url ?? undefined,
            syncState: SyncState.completed(),
            createdAt: p.created_at,
          })
      );

    return new Animal({
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      characteristics: new AnimalCharacteristics({
        species: row.species || 'Cão',
        size: row.size || 'Médio',
        approximateAge: row.approximate_age || '1 ano',
        sex: row.sex || 'Macho',
        characteristics: row.description ?? '',
        behavior: row.health_notes ?? '',
        specialCare: row.special_care ?? '',
      }),
      location: new ApproximateLocation({
        neighborhood: row.neighborhood || 'Centro',
        city: row.city || 'Varginha',
        region: row.region || 'MG',
        latitude: row.latitude ?? -21.55,
        longitude: row.longitude ?? -45.43,
      }),
      status: new AdoptionStatus(
        row.status === 'ADOPTED' ? ('ADOPTED' as AdoptionStatusType) : 'AVAILABLE'
      ),
      photos,
      hidden: row.moderation_status === 'HIDDEN',
      version: Number(row.version) || 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
