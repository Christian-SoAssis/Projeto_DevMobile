import { AdoptionInterest } from '../../domain/entities/AdoptionInterest';
import { AdoptionInterestRepository } from '../../domain/ports/AdoptionInterestRepository';
import { InterestRemoteGateway, RemoteInterest } from '../../domain/ports/InterestRemoteGateway';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { InterestStatus } from '../../domain/value-objects/InterestStatus';

/** Reconcile remote stages without overwriting an unsent local decision. */
export async function loadInterests(local: AdoptionInterestRepository, remote: InterestRemoteGateway | undefined,
  scope: 'user' | 'animal', id: string, queue?: SyncQueueRepository, onRemoteError?: () => void): Promise<RemoteInterest[]> {
  const cached = scope === 'user' ? await local.listByUser(id) : await local.listByAnimal(id);
  const rows = new Map<string, RemoteInterest>(cached.map(i => [i.id, { ...i, status: i.status.value }]));
  const pending = new Set((await queue?.listPending() ?? []).filter(a => a.entityType === 'interest').map(a => a.entityId));
  if (remote) {
    const incoming = await (scope === 'user' ? remote.listForUser(id) : remote.listForAnimal(id)).catch(() => { onRemoteError?.(); return []; });
    for (const r of incoming) {
      const previous = rows.get(r.id);
      if (previous && (pending.has(r.id) || Date.parse(previous.updatedAt ?? '') > Date.parse(r.updatedAt ?? r.createdAt ?? ''))) {
        rows.set(r.id, { ...r, status: previous.status, updatedAt: previous.updatedAt });
        continue;
      }
      const entity = new AdoptionInterest(r.id, r.userId, r.animalId, r.createdAt, InterestStatus.from(r.status), r.updatedAt);
      await local.registerInterest(entity);
      await local.updateStatus(entity.id, entity.status, entity.updatedAt);
      rows.set(r.id, { ...r, status: entity.status.value, updatedAt: entity.updatedAt });
    }
  }
  return [...rows.values()];
}
