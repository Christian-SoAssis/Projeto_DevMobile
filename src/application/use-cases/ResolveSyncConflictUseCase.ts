import { Animal } from '../../domain/entities/Animal';
import { SyncAction } from '../../domain/entities/SyncAction';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { RemoteAnimalSource } from '../../domain/ports/RemoteAnimalSource';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';

export interface ConflictView {
  action: SyncAction;
  local: Animal | null;
  /** `null` = o anúncio não existe mais no servidor. */
  remote: Animal | null;
}

/**
 * Revisão manual de conflitos (RF23, doc §9.4): quando o domínio não pode
 * escolher sozinho sem risco de perda, o responsável decide entre manter a
 * própria edição ou aceitar a versão do servidor.
 *
 * Consolidação (Fase A): este use case absorveu a revisão manual que antes
 * vivia em `ResolveConflictUseCase` (classe removida — nome divergente da
 * documentação, que exige `ResolveSyncConflictUseCase` nos §§3.2, 11, 16.2).
 * A avaliação automática do domínio permanece em
 * `ConflictResolutionService.evaluateAnimalConflict` — use cases não
 * duplicam regra de negócio.
 */
export class ResolveSyncConflictUseCase {
  constructor(
    private animalRepository: AnimalRepository,
    private remoteSource: RemoteAnimalSource,
    private syncQueueRepository: SyncQueueRepository
  ) {}

  async listConflicts(): Promise<ConflictView[]> {
    const pending = await this.syncQueueRepository.listPending();
    const conflicts = pending.filter((a) => a.isConflict && a.entityType === 'animal');
    const views: ConflictView[] = [];
    for (const action of conflicts) {
      views.push({
        action,
        local: await this.animalRepository.findById(action.entityId),
        remote: await this.remoteSource.findRemoteById(action.entityId),
      });
    }
    return views;
  }

  /** Mantém a edição local: ela volta à fila e sobrescreve a do servidor no próximo envio. */
  async keepLocal(actionId: string): Promise<void> {
    const action = await this.requireConflict(actionId);
    const local = await this.animalRepository.findById(action.entityId);
    if (!local) throw new Error('A edição local não existe mais.');
    const remote = await this.remoteSource.findRemoteById(action.entityId);

    if (!remote) {
      // Apagado no servidor: recria o anúncio a partir da cópia local.
      await this.syncQueueRepository.delete(action.id);
      await this.syncQueueRepository.enqueue(
        new SyncAction({
          id: `sync_create_${local.id}`,
          operation: 'CREATE',
          entityType: 'animal',
          entityId: local.id,
          payload: {},
        })
      );
      return;
    }

    local.rebaseOnRemoteVersion(remote.version);
    await this.animalRepository.saveLocal(local);
    action.clearConflict();
    await this.syncQueueRepository.update(action);
  }

  /** Aceita o servidor: a edição local é descartada e a ação sai da fila. */
  async useRemote(actionId: string): Promise<void> {
    const action = await this.requireConflict(actionId);
    const remote = await this.remoteSource.findRemoteById(action.entityId);
    if (remote) {
      await this.animalRepository.upsertCache([remote]);
    } else {
      await this.animalRepository.deleteLocal(action.entityId);
    }
    await this.syncQueueRepository.delete(action.id);
  }

  private async requireConflict(actionId: string): Promise<SyncAction> {
    const action = await this.syncQueueRepository.findById(actionId);
    if (!action || !action.isConflict) {
      throw new Error('Este conflito já foi resolvido.');
    }
    return action;
  }
}
