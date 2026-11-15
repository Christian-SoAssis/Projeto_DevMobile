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
      return { tombstones: [], nextCursor: null };
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

  async updateRemote(animal: Animal, _expectedVersion?: number): Promise<Animal> {
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
    const { error } = await this.client.from('animals').delete().eq('id', animalId);
    if (error) {
      throw new Error(`Falha ao excluir anúncio no Supabase: ${error.message}`);
    }
  }

  private async syncRemotePhotos(animal: Animal): Promise<void> {
    await this.client.from('animal_photos').delete().eq('animal_id', animal.id);

    const photos = animal.photos;
    if (photos.length === 0) return;

    const rows = photos.map((p, idx) => ({
      id: p.id,
      animal_id: animal.id,
      local_path: p.localPath ?? null,
      remote_url:
        p.remoteUrl ||
        p.localPath ||
        'https://images.unsplash.com/photo-1543466835-00a7907e9de1',
      is_main: idx === 0,
      upload_status: 'SYNCED',
      created_at: p.createdAt,
    }));

    const { error } = await this.client.from('animal_photos').insert(rows);
    if (error && !/duplicate/i.test(error.message || '')) {
      throw new Error(`Falha ao registrar fotos no Supabase: ${error.message}`);
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
      .filter((p) => Boolean(p.remote_url || p.local_path))
      .slice(0, 4)
      .map(
        (p) =>
          new AnimalPhoto({
            id: p.id,
            animalId: row.id,
            localPath: p.local_path ?? undefined,
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
