import { ModerationAction, ModerationGateway } from '../../../domain/ports/ModerationGateway';
import { SupabaseClientLike } from '../types';
import { RemoteSupabaseError } from './SupabaseAnimalRepository';

export interface SupabaseModerationRepositoryOptions {
  client: SupabaseClientLike;
}

/**
 * Implementação admin-side do port `ModerationGateway` (doc §15.1: política
 * de moderação `USING is_admin()`). O RLS do Postgres rejeita o `UPDATE` se
 * o usuário autenticado não for ADMIN — a validação do use case é a primeira
 * barreira, esta é a segunda (defesa em profundidade §15.3).
 *
 * Tipos de ação: enquanto a decisão definitiva do §4 não sair, apenas HIDE
 * (ocultar da leitura pública) e UNHIDE são aceitos — sem inventar o resto.
 */
export class SupabaseModerationRepository implements ModerationGateway {
  private client: SupabaseClientLike;

  constructor(options: SupabaseModerationRepositoryOptions) {
    this.client = options.client;
  }

  async moderateAnimal(animalId: string, action: ModerationAction): Promise<void> {
    const rows = await this.client
      .from('animals')
      .update({
        moderation_status: action === 'HIDE' ? 'HIDDEN' : 'NONE',
        moderated_at: action === 'HIDE' ? new Date().toISOString() : null,
      })
      .eq('id', animalId)
      .select();

    const { error } = (await Promise.resolve(rows)) as {
      error: { message: string } | null;
    };

    if (error) {
      throw new RemoteSupabaseError(`Falha ao moderar o anúncio: ${error.message}`);
    }
  }

  // O retorno (linhas atualizadas) não é necessário aqui: zero linhas com
  // usuário admin significa "animal inexistente" — mantido silencioso para
  // idempotência da fila (mesma postura do deleteRemote).
}
