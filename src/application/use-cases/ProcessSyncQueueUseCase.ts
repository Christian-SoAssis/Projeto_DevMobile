import { AdoptionInterest, InterestStage } from '../../domain/entities/AdoptionInterest';
import { AnimalPhoto } from '../../domain/entities/AnimalPhoto';
import { Favorite } from '../../domain/entities/Favorite';
import { SyncAction } from '../../domain/entities/SyncAction';
import { ConflictResolutionService } from '../../domain/services/ConflictResolutionService';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { FavoriteRemoteGateway } from '../../domain/ports/FavoriteRemoteGateway';
import { InterestRemoteGateway } from '../../domain/ports/InterestRemoteGateway';
import { PhotoStorage } from '../../domain/ports/PhotoStorage';
import { RemoteAnimalSource } from '../../domain/ports/RemoteAnimalSource';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';

export interface ProcessSyncQueueResult {
  processed: number;
  succeeded: number;
  failed: number;
  conflicts: Array<{ animalId: string; actionId: string; reason: string }>;
}

export interface ProcessSyncQueueOptions {
  remoteAnimals?: RemoteAnimalSource;
  favorites?: FavoriteRemoteGateway;
  interests?: InterestRemoteGateway;
  currentUserId?: () => string | null;
  /** Atraso em ms entre tentativas de uma mesma ação (padrão: backoff exponencial). */
  retryDelayMs?: (attempts: number) => number;
}

/** Backoff exponencial com jitter simples: 1s, 2s, 4s, 8s ... limitado a 30s. */
const defaultRetryDelayMs = (attempts: number): number => {
  const delay = Math.min(1000 * Math.pow(2, Math.max(0, attempts - 1)), 30_000);
  const jitter = Math.floor(Math.random() * 1_000);
  return delay + jitter;
};

/** Aguarda o número de milissegundos informado. */
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Processa a fila outbox local em ordem (UC17, §14.1, OFF-05, DAT-08, DAT-09, DAT-10).
 * Isola pendências entre contas: só envia ações da conta atualmente autenticada.
 */
export class ProcessSyncQueueUseCase {
  private conflictResolver: ConflictResolutionService;

  constructor(
    private syncQueueRepository: SyncQueueRepository,
    private animalRepository: AnimalRepository,
    conflictResolver?: ConflictResolutionService,
    private remotePhotoStorage?: PhotoStorage,
    private options: ProcessSyncQueueOptions = {}
  ) {
    this.conflictResolver = conflictResolver ?? new ConflictResolutionService();
  }

  async execute(): Promise<ProcessSyncQueueResult> {
    const allPending = await this.syncQueueRepository.listPending();
    const activeUserId = this.options.currentUserId ? this.options.currentUserId() : undefined;
    const retryDelay = this.options.retryDelayMs ?? defaultRetryDelayMs;

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    const conflicts: Array<{ animalId: string; actionId: string; reason: string }> = [];

    for (const action of allPending) {
      // DAT-10: se há filtro de sessão ativa e a ação pertence a outro usuário, pausa sem falhar.
      if (activeUserId !== undefined) {
        if (!activeUserId) continue;
        if (action.ownerId && action.ownerId !== activeUserId) continue;
      }

      processed += 1;

      // Backoff exponencial: verifica se o tempo mínimo decorrido desde a última tentativa já passou.
      // Em vez de travar a thread com sleep, pula a ação para a próxima rodada se o intervalo ainda não expirou.
      if (action.attempts > 0) {
        const lastAttemptMs = Date.parse(action.changedAt);
        if (!Number.isNaN(lastAttemptMs)) {
          const elapsed = Date.now() - lastAttemptMs;
          const minDelay = retryDelay(action.attempts);
          if (elapsed < minDelay) {
            continue;
          }
        }
      }

      action.startSync();
      await this.syncQueueRepository.update(action);

      try {
        await this.processSingleAction(action, conflicts);
        if (action.status.isCompleted()) {
          await this.syncQueueRepository.delete(action.id);
          succeeded += 1;
        } else {
          await this.syncQueueRepository.update(action);
          failed += 1;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido na sincronização.';
        action.markFailed(message);
        await this.syncQueueRepository.update(action);
        failed += 1;
      }
    }

    return { processed, succeeded, failed, conflicts };
  }

  private async processSingleAction(
    action: SyncAction,
    conflicts: Array<{ animalId: string; actionId: string; reason: string }>
  ): Promise<void> {
    if (action.entityType === 'animal') {
      await this.processAnimalAction(action, conflicts);
      return;
    }

    if (action.entityType === 'favorite') {
      if (!this.options.favorites) {
        throw new Error('Sincronização de favoritos indisponível sem backend.');
      }
      const userId = String(action.payload.userId ?? action.payload.ownerId ?? '');
      const animalId = String(action.payload.animalId ?? '');
      if (action.operation === 'DELETE') {
        await this.options.favorites.remove(userId, animalId);
      } else {
        await this.options.favorites.upsert(new Favorite({ userId, animalId }));
      }
      action.markCompleted();
      return;
    }

    if (action.entityType === 'interest') {
      if (!this.options.interests) {
        throw new Error('Sincronização de interesses indisponível sem backend.');
      }
      if (action.operation === 'UPDATE') {
        const status = (action.payload.status as InterestStage) ?? 'ENVIADA';
        await this.options.interests.updateStatus(action.entityId, status);
      } else {
        const interest = new AdoptionInterest({
          id: action.entityId,
          userId: String(action.payload.userId ?? action.payload.ownerId ?? ''),
          animalId: String(action.payload.animalId ?? ''),
          message: String(action.payload.message ?? ''),
          contactInfo: String(action.payload.contactInfo ?? ''),
          status: (action.payload.status as InterestStage) ?? 'ENVIADA',
        });
        await this.options.interests.upsert(interest);
      }
      action.markCompleted();
      return;
    }

    action.markCompleted();
  }

  private async processAnimalAction(
    action: SyncAction,
    conflicts: Array<{ animalId: string; actionId: string; reason: string }>
  ): Promise<void> {
    const remoteAnimals = this.options.remoteAnimals;
    if (!remoteAnimals) {
      throw new Error('Sincronização de anúncios indisponível sem backend.');
    }

    if (action.operation === 'DELETE') {
      await remoteAnimals.deleteRemote(action.entityId);
      action.markCompleted();
      return;
    }

    const localAnimal = await this.animalRepository.findById(action.entityId);
    if (!localAnimal) {
      action.markCompleted();
      return;
    }

    // Passo 5 (§14.1): Upload das fotos pendentes antes de reconciliar o anúncio
    if (this.remotePhotoStorage) {
      const uploadedPhotos: AnimalPhoto[] = [];
      for (const photo of localAnimal.photos) {
        if (!photo.remoteUrl && photo.localPath) {
          const uploaded = await this.remotePhotoStorage.uploadPending(photo);
          uploadedPhotos.push(uploaded);
        } else {
          uploadedPhotos.push(photo);
        }
      }
      localAnimal.setPhotos(uploadedPhotos);
      await this.animalRepository.saveLocal(localAnimal);
    }

    if (action.operation === 'CREATE') {
      const created = await remoteAnimals.createRemote(localAnimal);
      await this.animalRepository.saveLocal(created);
      action.markCompleted();
      return;
    }

    // UPDATE ou MARK_ADOPTED: verifica versão remota para detectar conflitos (RF23/RNF03)
    const remoteExisting = await remoteAnimals.findById(localAnimal.id);
    const expectedVersion =
      typeof action.payload.expectedVersion === 'number'
        ? action.payload.expectedVersion
        : localAnimal.version - 1;

    if (remoteExisting && remoteExisting.version > expectedVersion) {
      const evaluation = this.conflictResolver.evaluate(localAnimal, remoteExisting);
      if (evaluation.type === 'MANUAL_REVIEW_REQUIRED') {
        conflicts.push({
          animalId: localAnimal.id,
          actionId: action.id,
          reason: evaluation.reason,
        });
        action.markFailed(`[CONFLITO] ${evaluation.reason}`);
        return;
      }

      if (evaluation.winner === 'REMOTE') {
        await this.animalRepository.saveLocal(remoteExisting);
        action.markCompleted();
        return;
      }
    }

    const updated = await remoteAnimals.updateRemote(localAnimal, expectedVersion);
    await this.animalRepository.saveLocal(updated);
    action.markCompleted();
  }
}
