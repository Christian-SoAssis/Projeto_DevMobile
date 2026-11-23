import { Animal } from '../../../domain/entities/Animal';
import { ModerationAction, ModerationGateway } from '../../../domain/ports/ModerationGateway';
import { SupabaseClientLike } from '../types';
import { SupabaseAnimalRepository } from './SupabaseAnimalRepository';

export class SupabaseModerationRepository implements ModerationGateway {
  private animalRepo: SupabaseAnimalRepository;

  constructor(private client: SupabaseClientLike) {
    this.animalRepo = new SupabaseAnimalRepository(client);
  }

  async listAllForModeration(): Promise<Animal[]> {
    const { data, error } = await this.client
      .from('animals')
      .select('*, animal_photos(*)')
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error || !data) {
      throw new Error(error?.message || 'Não foi possível carregar anúncios para moderação.');
    }

    return (data as any[]).map((row) => this.animalRepo.mapRowToEntity(row));
  }

  async moderateAnimal(animalId: string, action: ModerationAction): Promise<void> {
    const moderationStatus = action === 'HIDE' ? 'HIDDEN' : 'NONE';
    const { error } = await this.client
      .from('animals')
      .update({
        moderation_status: moderationStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', animalId);

    if (error) {
      throw new Error(`Falha ao aplicar moderação: ${error.message}`);
    }
  }
}
