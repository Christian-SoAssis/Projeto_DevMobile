import { FavoriteRemoteGateway } from '../../../domain/ports/FavoriteRemoteGateway';
import { InterestRemoteGateway, RemoteInterest } from '../../../domain/ports/InterestRemoteGateway';
import { SupabaseClientLike, FavoriteRow, AdoptionInterestRow } from '../types';
import { RemoteSupabaseError } from './SupabaseAnimalRepository';

/** Código do Postgres para violação de unicidade: o registro já existe. */
const UNIQUE_VIOLATION = '23505';

/**
 * Favoritos no Supabase. `favorites` é 100% privada por usuário (RLS
 * `favorites_owner_all`, doc §15.1): a RLS repete a checagem que o app já fez.
 */
export class SupabaseFavoriteGateway implements FavoriteRemoteGateway {
  constructor(private client: SupabaseClientLike) {}

  async addRemote(userId: string, animalId: string): Promise<void> {
    const { error } = await this.client
      .from<FavoriteRow>('favorites')
      .insert({ user_id: userId, animal_id: animalId });
    // Já favoritado no servidor: a ação da fila é idempotente.
    if (error && error.code !== UNIQUE_VIOLATION) {
      throw new RemoteSupabaseError(`Falha ao salvar o favorito no servidor: ${error.message}`);
    }
  }

  async removeRemote(userId: string, animalId: string): Promise<void> {
    const { error } = await this.client
      .from<FavoriteRow>('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('animal_id', animalId);
    if (error) {
      throw new RemoteSupabaseError(`Falha ao remover o favorito no servidor: ${error.message}`);
    }
  }
}

/**
 * Interesses de adoção no Supabase. O interessado grava o próprio registro;
 * o responsável pelo anúncio lê os recebidos (política
 * `interests_animal_owner_read`, `is_animal_owner`).
 */
export class SupabaseInterestGateway implements InterestRemoteGateway {
  constructor(private client: SupabaseClientLike) {}

  async createRemote(interest: RemoteInterest): Promise<void> {
    const { error } = await this.client.from<AdoptionInterestRow>('adoption_interests').insert({
      id: interest.id,
      user_id: interest.userId,
      animal_id: interest.animalId,
      message: interest.message ?? null,
      contact_name: interest.contactName ?? null,
      contact_email: interest.contactEmail ?? null,
      contact_phone: interest.contactPhone ?? null,
      // Decisão 18: novas manifestações nascem ENVIADA (legado era 'PENDING').
      status: interest.status ?? 'ENVIADA',
      created_at: interest.createdAt ?? new Date().toISOString(),
    });
    if (error && error.code !== UNIQUE_VIOLATION) {
      throw new RemoteSupabaseError(`Falha ao enviar o interesse ao servidor: ${error.message}`);
    }
  }

  async listForAnimal(animalId: string): Promise<RemoteInterest[]> {
    const { data, error } = await this.client
      .from<AdoptionInterestRow>('adoption_interests')
      .select('*')
      .eq('animal_id', animalId)
      .order('created_at', { ascending: false });
    if (error) {
      throw new RemoteSupabaseError(`Falha ao ler os interesses recebidos: ${error.message}`);
    }
    return (data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      animalId: row.animal_id,
      message: row.message ?? undefined,
      contactName: row.contact_name ?? undefined,
      contactEmail: row.contact_email ?? undefined,
      contactPhone: row.contact_phone ?? undefined,
      status: row.status ?? undefined,
      updatedAt: row.updated_at ?? undefined,
      createdAt: row.created_at,
    }));
  }

  // Trilha (decisão 18): o interessado lê as PRÓPRIAS manifestações — a RLS
  // das linhas privadas por usuário já cobre (§15.1).
  async listForUser(userId: string): Promise<RemoteInterest[]> {
    const { data, error } = await this.client
      .from<AdoptionInterestRow>('adoption_interests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) {
      throw new RemoteSupabaseError(`Falha ao ler suas manifestações: ${error.message}`);
    }
    return (data ?? []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      animalId: row.animal_id,
      message: row.message ?? undefined,
      contactName: row.contact_name ?? undefined,
      contactEmail: row.contact_email ?? undefined,
      contactPhone: row.contact_phone ?? undefined,
      status: row.status ?? undefined,
      updatedAt: row.updated_at ?? undefined,
      createdAt: row.created_at,
    }));
  }

  // Responsável avança/recusa: RLS do servidor precisa autorizar o dono do
  // animal a `update` (policy `interests_animal_owner_update`). Sem o error
  // silencioso: falha volta para a fila (RNF02).
  async updateStatusRemote(interestId: string, status: string, updatedAt?: string): Promise<void> {
    const { data, error } = await this.client
      .from<AdoptionInterestRow>('adoption_interests')
      .update({ status, updated_at: updatedAt ?? new Date().toISOString() })
      .eq('id', interestId).select();
    if (error || !data?.length) {
      throw new RemoteSupabaseError(`Falha ao atualizar a etapa da manifestação: ${error?.message ?? "Registro indisponível ou sem permissão"}`);
    }
  }
}
