import { User } from '../../domain/entities/User';
import { AnimalPhoto } from '../../domain/entities/AnimalPhoto';
import { AuthGateway } from '../../domain/ports/AuthGateway';
import { UserRepository } from '../../domain/ports/UserRepository';
import { PhotoStorage } from '../../domain/ports/PhotoStorage';
import { ProfilePatch } from '../../domain/value-objects/UserProfile';
import { SyncState } from '../../domain/value-objects/SyncState';

export interface UpdateProfileResult {
  user: User;
  /** `false` = salvo só no aparelho (sem rede/servidor); o usuário é avisado. */
  syncedRemotely: boolean;
}

/**
 * Atualiza o perfil do usuário autenticado (nome, telefone, descrição,
 * interesses e foto).
 *
 * Offline-first (RNF01/RNF02): o perfil é gravado no SQLite ANTES de tentar o
 * servidor, então uma falha de rede nunca descarta a edição. A foto de perfil
 * fica só no aparelho até o Storage do Supabase (Passo 4).
 */
export class UpdateProfileUseCase {
  constructor(
    private authGateway: AuthGateway,
    private userRepository: UserRepository,
    private photoStorage?: PhotoStorage
  ) {}

  async execute(current: User, patch: ProfilePatch): Promise<UpdateProfileResult> {
    // Valida (lança em nome vazio, descrição longa etc.) antes de qualquer efeito.
    let updated = current.withProfile({ ...patch, avatarUri: undefined });

    const avatarChanged = patch.avatarUri !== undefined && (patch.avatarUri || undefined) !== current.avatarUri;
    if (avatarChanged) {
      updated = updated.withProfile({ avatarUri: await this.persistAvatar(current.id, patch.avatarUri) });
    }

    await this.userRepository.save(updated);

    try {
      await this.authGateway.updateProfile(updated);
      return { user: updated, syncedRemotely: true };
    } catch {
      return { user: updated, syncedRemotely: false };
    }
  }

  private async persistAvatar(userId: string, uri: string | null | undefined): Promise<string | null> {
    if (!uri) return null;
    if (!this.photoStorage) return uri;
    const saved = await this.photoStorage.persistLocal(
      new AnimalPhoto({
        // Id único por troca: o caminho copiado muda e o <Image> não serve cache velho.
        id: `avatar_${userId}_${Date.now()}`,
        animalId: `user:${userId}`,
        localPath: uri,
        // SYNCED: avatar nunca entra na fila de upload de fotos de anúncios.
        syncState: SyncState.completed(),
      })
    );
    return saved.localPath ?? uri;
  }
}
