import { User } from '../../domain/entities/User';
import { AnimalPhoto } from '../../domain/entities/AnimalPhoto';
import { AuthGateway } from '../../domain/ports/AuthGateway';
import { UserRepository } from '../../domain/ports/UserRepository';
import { PhotoStorage } from '../../domain/ports/PhotoStorage';
import { ProfilePatch } from '../../domain/value-objects/UserProfile';
import { SyncState } from '../../domain/value-objects/SyncState';
import { newUuid } from '../../domain/services/IdGenerator';

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
 * servidor, então uma falha de rede nunca descarta a edição. A foto sobe ao
 * Storage quando há backend e rede; senão fica só no aparelho e é reenviada
 * na próxima edição salva.
 */
export class UpdateProfileUseCase {
  constructor(
    private authGateway: AuthGateway,
    private userRepository: UserRepository,
    private photoStorage?: PhotoStorage,
    /** Upload ao Storage — só informado com backend configurado. */
    private remotePhotoStorage?: PhotoStorage
  ) {}

  async execute(current: User, patch: ProfilePatch): Promise<UpdateProfileResult> {
    // Valida (lança em nome vazio, descrição longa etc.) antes de qualquer efeito.
    let updated = current.withProfile({ ...patch, avatarUri: undefined, avatarUrl: undefined });

    const avatarChanged = patch.avatarUri !== undefined && (patch.avatarUri || undefined) !== current.avatarUri;
    if (avatarChanged) {
      const saved = await this.persistAvatar(current.id, patch.avatarUri);
      // Foto nova invalida a URL antiga; removida limpa as duas.
      updated = updated.withProfile({ avatarUri: saved?.localPath ?? null, avatarUrl: null });
    }

    if (updated.avatarUri && !updated.avatarUrl) {
      const url = await this.tryUploadAvatar(updated);
      if (url) updated = updated.withProfile({ avatarUrl: url });
    }

    await this.userRepository.save(updated);

    try {
      await this.authGateway.updateProfile(updated);
      return { user: updated, syncedRemotely: true };
    } catch {
      return { user: updated, syncedRemotely: false };
    }
  }

  private async persistAvatar(userId: string, uri: string | null | undefined): Promise<AnimalPhoto | null> {
    if (!uri) return null;
    const photo = new AnimalPhoto({
      // Id único por troca: o caminho copiado muda e o <Image> não serve cache velho.
      id: `avatar_${userId}_${Date.now()}`,
      animalId: `user:${userId}`,
      localPath: uri,
      // SYNCED: avatar nunca entra na fila de upload de fotos de anúncios.
      syncState: SyncState.completed(),
    });
    if (!this.photoStorage) return photo;
    return this.photoStorage.persistLocal(photo);
  }

  /** Falha de rede/servidor não impede salvar o perfil: a foto segue local. */
  private async tryUploadAvatar(user: User): Promise<string | null> {
    if (!this.remotePhotoStorage || !user.avatarUri) return null;
    try {
      const photo = new AnimalPhoto({
        id: newUuid(),
        animalId: `user:${user.id}`,
        localPath: user.avatarUri,
        syncState: SyncState.pending(),
      });
      const uploaded = await this.remotePhotoStorage.uploadPending(photo);
      return uploaded.remoteUrl ?? null;
    } catch {
      return null;
    }
  }
}
