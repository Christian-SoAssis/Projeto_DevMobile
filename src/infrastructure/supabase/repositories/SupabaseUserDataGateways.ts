import {
  AdoptionInterest,
  InterestStage,
  normalizeInterestStage,
} from '../../../domain/entities/AdoptionInterest';
import { Favorite } from '../../../domain/entities/Favorite';
import { FavoriteRemoteGateway } from '../../../domain/ports/FavoriteRemoteGateway';
import { InterestRemoteGateway } from '../../../domain/ports/InterestRemoteGateway';
import { SupabaseClientLike } from '../types';

export class SupabaseFavoriteGateway implements FavoriteRemoteGateway {
  constructor(private client: SupabaseClientLike) {}

  async listByUser(userId: string): Promise<Favorite[]> {
    const { data, error } = await this.client
      .from('favorites')
      .select('*')
      .eq('user_id', userId);

    if (error || !data) return [];
    return (data as Array<{ user_id: string; animal_id: string; created_at: string }>).map(
      (r) =>
        new Favorite({
          userId: r.user_id,
          animalId: r.animal_id,
          createdAt: r.created_at,
        })
    );
  }

  async upsert(favorite: Favorite): Promise<void> {
    const { data: existing } = await this.client
      .from('favorites')
      .select('id')
      .eq('user_id', favorite.userId)
      .eq('animal_id', favorite.animalId)
      .maybeSingle();

    if (existing) return;

    const { error } = await this.client.from('favorites').insert({
      user_id: favorite.userId,
      animal_id: favorite.animalId,
    });

    if (error && !String(error.message).includes('duplicate')) {
      throw new Error(`Falha ao sincronizar favorito: ${error.message}`);
    }
  }

  async remove(userId: string, animalId: string): Promise<void> {
    const { error } = await this.client
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('animal_id', animalId);

    if (error) {
      throw new Error(`Falha ao remover favorito remoto: ${error.message}`);
    }
  }
}

interface RemoteInterestRow {
  id: string;
  user_id: string;
  animal_id: string;
  message: string | null;
  contact_phone: string | null;
  contact_name: string | null;
  contact_email: string | null;
  status: string | null;
  created_at: string;
  updated_at: string | null;
}

export class SupabaseInterestGateway implements InterestRemoteGateway {
  constructor(private client: SupabaseClientLike) {}

  async upsert(interest: AdoptionInterest): Promise<void> {
    const { data: existing } = await this.client
      .from('adoption_interests')
      .select('id')
      .eq('id', interest.id)
      .maybeSingle();

    if (existing) return;

    const { error } = await this.client.from('adoption_interests').insert({
      id: interest.id,
      user_id: interest.userId,
      animal_id: interest.animalId,
      message: interest.message || 'Tenho interesse em adotar!',
      contact_phone: interest.contactInfo || null,
      contact_name: interest.userName || null,
      contact_email: interest.userEmail || interest.contactInfo || null,
      status: interest.status,
    });

    if (error && !/duplicate/i.test(error.message || '')) {
      throw new Error(`Falha ao enviar interesse ao Supabase: ${error.message}`);
    }
  }

  async updateStatus(id: string, status: InterestStage): Promise<void> {
    const { error } = await this.client
      .from('adoption_interests')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw new Error(`Falha ao atualizar status do interesse: ${error.message}`);
    }
  }

  async listByUser(userId: string): Promise<AdoptionInterest[]> {
    const { data, error } = await this.client
      .from('adoption_interests')
      .select('*')
      .eq('user_id', userId);

    if (error || !data) return [];
    return (data as RemoteInterestRow[]).map((r) => this.mapRow(r));
  }

  async listByAnimal(animalId: string): Promise<AdoptionInterest[]> {
    const { data, error } = await this.client
      .from('adoption_interests')
      .select('*')
      .eq('animal_id', animalId);

    if (error || !data) return [];
    return (data as RemoteInterestRow[]).map((r) => this.mapRow(r));
  }

  private mapRow(row: RemoteInterestRow): AdoptionInterest {
    return new AdoptionInterest({
      id: row.id,
      userId: row.user_id,
      userName: row.contact_name ?? undefined,
      userEmail: row.contact_email ?? undefined,
      animalId: row.animal_id,
      message: row.message ?? '',
      contactInfo: row.contact_phone || row.contact_email || '',
      status: normalizeInterestStage(row.status),
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? row.created_at,
    });
  }
}
