import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { PhotoStorage } from '../../domain/ports/PhotoStorage';
import { RemoteAnimalSource } from '../../domain/ports/RemoteAnimalSource';
import { FavoriteRemoteGateway } from '../../domain/ports/FavoriteRemoteGateway';
import { InterestRemoteGateway } from '../../domain/ports/InterestRemoteGateway';
import { Animal } from '../../domain/entities/Animal';
import { SyncAction } from '../../domain/entities/SyncAction';
import { SincronizacaoService } from '../../domain/services/SincronizacaoService';
import { PermanentSyncError } from '../../domain/services/SincronizacaoService';
import { ConflictResolutionService } from '../../domain/services/ConflictResolutionService';

export interface SyncProcessResult {
  processedCount: number;
  successCount: number;
  failedCount: number;
  /** Ações paradas à espera de revisão do responsável (RF23). */
  conflictCount?: number;
}

/** Dependências remotas opcionais: só existem com backend configurado. */
export interface ProcessSyncExtras {
  /** Necessário para resolver `UPDATE` defasado (doc §9.4). */
  remoteAnimals?: RemoteAnimalSource;
  favorites?: FavoriteRemoteGateway;
  interests?: InterestRemoteGateway;
}

/** O servidor recusou o `UPDATE` porque a versão remota avançou (bloqueio otimista, doc §14.3). */
const STALE_VERSION_ERROR = 'StaleVersionError';

/** Conflito que o domínio não resolve sozinho: vira item de revisão manual. */
class NeedsReviewError extends Error {}

export class ProcessSyncQueueUseCase {
  private isRunning = false;

  constructor(
    private syncQueueRepository: SyncQueueRepository,
    private animalRepository: AnimalRepository,
    private maxAttempts: number = 5,
    /**
     * Upload remoto das fotos (só informado com backend configurado). As
     * imagens sobem ANTES da gravação do anúncio (doc §14.1 passos 5–6).
     */
    private remotePhotoStorage?: PhotoStorage,
    private extras: ProcessSyncExtras = {},
    /** Relógio injetável (testes determinísticos do backoff). */
    private nowMs: () => number = () => Date.now()
  ) {}

  async execute(): Promise<SyncProcessResult> {
    // Evita duas execuções concorrentes da mesma fila (doc §14.1 passo 2).
    if (this.isRunning) {
      return { processedCount: 0, successCount: 0, failedCount: 0, conflictCount: 0 };
    }

    this.isRunning = true;
    try {
      const pending = await this.syncQueueRepository.listPending();
      let successCount = 0;
      let failedCount = 0;
      let conflictCount = 0;

      for (const action of pending) {
        if (action.isConflict) {
          // Aguarda revisão manual: nunca é reenviada sozinha.
          conflictCount += 1;
          continue;
        }
        if (action.status.isFailed()) {
          // OFF-05/DAT-11 (ordem 7): falha PERMANENTE nunca é reenviada —
          // retry não resolve e tentar é custo certo no resto da fila.
          if (SincronizacaoService.isPermanente(action.lastError)) {
            failedCount += 1;
            continue;
          }
          // Tentativas esgotadas: falha reconhecida, sem novo envio.
          if (!action.canRetry(this.maxAttempts)) {
            failedCount += 1;
            continue;
          }
          // Espaçamento do backoff (2s, 4s … cap 30s desde a ÚLTIMA falha):
          // antes de vencer a espera, a ação fica parada sem novo envio.
          if (!SincronizacaoService.retryIsDue(action, this.maxAttempts, this.nowMs())) {
            continue;
          }
        }

        action.markSyncing();
        await this.syncQueueRepository.update(action);

        try {
          await this.applyAction(action);
          action.markCompleted();
          await this.syncQueueRepository.update(action);
          successCount += 1;
        } catch (err: any) {
          // A falha é um "change": o timestamp da ÚLTIMA falha baseia o
          // backoff do próximo ciclo (OFF-05). Relógio injetável para
          // testes determinísticos.
          const failureAt = new Date(this.nowMs()).toISOString();
          if (err instanceof NeedsReviewError) {
            action.markConflict(err.message);
            conflictCount += 1;
          } else if (err instanceof PermanentSyncError) {
            // DAT-11: erro lógico — retry não resolve; parado com marca
            // que sobrevive a reinícios (doc §9.4 RF23 para o conflito).
            action.markFailedPermanently(err.message, failureAt);
            failedCount += 1;
          } else {
            action.markFailed(err?.message || 'Erro ao sincronizar item.', failureAt);
            failedCount += 1;
          }
          await this.syncQueueRepository.update(action);
        }
      }

      await this.syncQueueRepository.clearCompleted();

      return {
        processedCount: pending.length,
        successCount,
        failedCount,
        conflictCount,
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Envia as fotos locais ainda sem URL remota e persiste a URL no cache
   * local. Se um upload falhar, a ação inteira falha e é reenviada depois
   * (sem anúncio remoto apontando para foto inexistente).
   */
  private async uploadPendingPhotos(animal: Animal): Promise<void> {
    if (!this.remotePhotoStorage) return;
    let uploadedAny = false;
    for (const photo of animal.photos) {
      if (photo.remoteUrl || !photo.localPath) continue;
      await this.remotePhotoStorage.uploadPending(photo);
      uploadedAny = true;
    }
    if (uploadedAny) {
      await this.animalRepository.saveLocal(animal);
    }
  }

  private async applyAction(action: SyncAction): Promise<void> {
    switch (action.entityType) {
      case 'animal':
        return this.applyAnimalAction(action);
      case 'favorite':
        return this.applyFavoriteAction(action);
      case 'interest':
        return this.applyInterestAction(action);
      default:
        throw new PermanentSyncError(
          `Sincronização remota de ${action.entityType} ainda não está disponível.`
        );
    }
  }

  private async applyAnimalAction(action: SyncAction): Promise<void> {
    switch (action.operation) {
      case 'CREATE': {
        const animal = await this.requireLocalAnimal(action);
        await this.uploadPendingPhotos(animal);
        await this.animalRepository.createRemote(animal);
        return;
      }
      case 'UPDATE':
      case 'MARK_ADOPTED': {
        const animal = await this.requireLocalAnimal(action);
        await this.uploadPendingPhotos(animal);
        try {
          await this.animalRepository.updateRemote(animal);
        } catch (err: any) {
          if (err?.name !== STALE_VERSION_ERROR) throw err;
          await this.resolveStaleUpdate(animal);
        }
        return;
      }
      case 'DELETE':
        // Delete remoto é idempotente: excluir algo já ausente não é erro.
        await this.animalRepository.deleteRemote(action.entityId);
        await this.animalRepository.deleteLocal(action.entityId);
        return;
      default:
        throw new PermanentSyncError(`Operação de sincronização não suportada: ${action.operation}`);
    }
  }

  private async requireLocalAnimal(action: SyncAction): Promise<Animal> {
    const animal = await this.animalRepository.findById(action.entityId);
    if (!animal) {
      throw new PermanentSyncError('Registro local do anúncio não encontrado para sincronizar.');
    }
    return animal;
  }

  /**
   * Doc §9.4: conflito simples (mesma situação do animal) → vence a versão
   * mais recente, sem perguntar; risco de perda (situação divergente) →
   * revisão manual do responsável (`NeedsReviewError`).
   */
  private async resolveStaleUpdate(local: Animal): Promise<void> {
    const source = this.extras.remoteAnimals;
    if (!source) {
      throw new NeedsReviewError('A versão do servidor mudou e não foi possível comparar. Revise o anúncio.');
    }
    const remote = await source.findRemoteById(local.id);
    if (!remote) {
      throw new NeedsReviewError('O anúncio não existe mais no servidor. Escolha recriá-lo ou descartar a edição.');
    }
    const evaluation = ConflictResolutionService.evaluateStaleUpdate(local, remote);
    if (evaluation.needsReview) {
      throw new NeedsReviewError(evaluation.reason ?? 'Conflito com risco de perda de dados.');
    }
    if (evaluation.chosenVersion === local) {
      local.rebaseOnRemoteVersion(remote.version);
      await this.animalRepository.saveLocal(local);
      await this.animalRepository.updateRemote(local);
      return;
    }
    await this.animalRepository.upsertCache([remote]);
  }

  private async applyFavoriteAction(action: SyncAction): Promise<void> {
    const gateway = this.extras.favorites;
    if (!gateway) throw new PermanentSyncError('Sincronização de favoritos indisponível sem backend.');
    const userId = String(action.payload.userId ?? '');
    const animalId = String(action.payload.animalId ?? '');
    if (!userId || !animalId) throw new PermanentSyncError('Favorito sem usuário ou animal.');
    if (action.operation === 'CREATE') {
      await gateway.addRemote(userId, animalId);
    } else if (action.operation === 'DELETE') {
      await gateway.removeRemote(userId, animalId);
    } else {
      throw new PermanentSyncError(`Operação de sincronização não suportada: ${action.operation}`);
    }
  }

  private async applyInterestAction(action: SyncAction): Promise<void> {
    const gateway = this.extras.interests;
    if (!gateway) throw new PermanentSyncError('Sincronização de interesses indisponível sem backend.');
    if (action.operation !== 'CREATE') {
      throw new PermanentSyncError(`Operação de sincronização não suportada: ${action.operation}`);
    }
    const p = action.payload;
    await gateway.createRemote({
      id: String(p.id ?? action.entityId),
      userId: String(p.userId ?? ''),
      animalId: String(p.animalId ?? ''),
      message: typeof p.message === 'string' ? p.message : undefined,
      contactName: typeof p.contactName === 'string' ? p.contactName : undefined,
      contactEmail: typeof p.contactEmail === 'string' ? p.contactEmail : undefined,
      contactPhone: typeof p.contactPhone === 'string' ? p.contactPhone : undefined,
      createdAt: typeof p.createdAt === 'string' ? p.createdAt : undefined,
    });
  }
}
