import { loadInterests } from './LoadInterestsUseCase';
import { AppStateRepository } from '../../domain/ports/AppStateRepository';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { AdoptionInterestRepository } from '../../domain/ports/AdoptionInterestRepository';
import { InterestRemoteGateway, RemoteInterest } from '../../domain/ports/InterestRemoteGateway';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';

import { InterestStatus } from '../../domain/value-objects/InterestStatus';
import { PERMANENT_SYNC_FAILURE_MARKER, SYNC_CONFLICT_MARKER } from '../../domain/entities/SyncAction';

export type NotificationKind = 'INTEREST_RECEIVED' | 'STATUS_CHANGED' | 'SYNC_FAILED';

/** Item derivado — não há tabela de notificações (decisão 20: feed do dado real). */
export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Momento do dado de ORIGEM (createdAt/updatedAt/changedAt) — ordena o feed. */
  at: string;
  /** `false` = não-vista (`at` posterior ao último abrir da central). */
  seen: boolean;
  /** Anúncio alvo (abrir a notificação navega aos detalhes). */
  animalId?: string;
}

export interface NotificationFeed {
  items: NotificationItem[];
  unseenCount: number;
}

export interface BuildNotificationsExtras {
  animalRepository?: AnimalRepository;
  /** Manifestações do próprio usuário (adotante). */
  localInterests?: AdoptionInterestRepository;
  /** Interesses recebidos (responsável) + etapas vindas do servidor. */
  remoteInterests?: InterestRemoteGateway;
  syncQueueRepository?: SyncQueueRepository;
}

/** Chave por usuário (múltiplas contas no aparelho não disputam o badge). */
export function notificationsLastSeenKey(userId: string): string {
  return `notifications_last_seen:${userId}`;
}

/**
 * Central de notificações in-app (decisão 20, melhoria #7). NADA novo é
 * persistido para "notificações": o feed é DERIVADO dos dados que já existem —
 * interesses recebidos no anúncio (responsável), etapas das próprias
 * manifestações (adotante, ao vivo via servidor) e itens FAILED da fila local.
 * `notifications_last_seen` (app_state) persiste no aparelho: o badge sobrevive
 * a reinícios. Abrir a central = markSeen() (zera o badge).
 */
export class BuildNotificationsUseCase {
  constructor(private appState: AppStateRepository, private extras: BuildNotificationsExtras = {}) {}

  async execute(userId: string): Promise<NotificationFeed> {
    if (!userId) return { items: [], unseenCount: 0 };
    const lastSeen = (await this.appState.get(notificationsLastSeenKey(userId))) ?? '';
    const items: NotificationItem[] = [];

    // 1) Responsável: interesses recebidos nos próprios anúncios (servidor).
    if (this.extras.animalRepository && this.extras.localInterests && userId) {
      let animals: Awaited<ReturnType<AnimalRepository["listByOwner"]>>;
      try {
        animals = await this.extras.animalRepository.listByOwner(userId);
      } catch {
        animals = [];
      }
      for (const animal of animals) {
        let received: RemoteInterest[] = [];
        try {
          received = await loadInterests(this.extras.localInterests!, this.extras.remoteInterests, 'animal', animal.id, this.extras.syncQueueRepository);
        } catch {
          received = []; // sem conexão: o feed não quebra (UI nunca é barreira)
        }
        for (const interest of received) {
          const at = interest.createdAt ?? '';
          items.push({
            id: `interest:${interest.id}`,
            kind: 'INTEREST_RECEIVED',
            title: `Novo interesse em ${animal.name}`,
            body: interest.contactName
              ? `${interest.contactName} quer adotar. Veja o contato nos detalhes do anúncio.`
              : 'Alguém demonstrou interesse. Veja o contato nos detalhes do anúncio.',
            at,
            seen: Date.parse(at) <= Date.parse(lastSeen),
            animalId: animal.id,
          });
        }
      }
    }

    // 2) Adotante: as PRÓPRIAS manifestações com a etapa alterada — o estado
    // vivo vem do servidor (a decisão é do responsável); sem backend, o local.
    const byId = new Map<string, { status: InterestStatus; updatedAt: string; animalId: string }>();
    if (this.extras.localInterests) {
      try {
        for (const interest of await this.extras.localInterests.listByUser(userId)) {
          byId.set(interest.id, {
            status: interest.status,
            updatedAt: interest.updatedAt,
            animalId: interest.animalId,
          });
        }
      } catch {
        // local indisponível: o remoto cobre
      }
    }
    if (this.extras.remoteInterests) {
      try {
        for (const r of await (this.extras.localInterests ? loadInterests(this.extras.localInterests, this.extras.remoteInterests, 'user', userId, this.extras.syncQueueRepository) : this.extras.remoteInterests.listForUser(userId))) {
          // Servidor vence: a decisão do responsável é a fonte da etapa. O
          // `updatedAt` remoto (quando veio) marca a hora REAL da mudança.
          byId.set(r.id, {
            status: InterestStatus.from(r.status),
            updatedAt: r.updatedAt ?? r.createdAt ?? '',
            animalId: r.animalId,
          });
        }
      } catch {
        // sem conexão: o local cobre
      }
    }
    if (this.extras.animalRepository) {
      for (const row of byId.values()) {
        if (row.status.value === 'ENVIADA') continue; // nascimento não é "mudança"
        items.push({
          id: `status:${row.animalId}:${row.updatedAt}`,
          kind: 'STATUS_CHANGED',
          title: 'Sua manifestação mudou de etapa',
          body: row.status.isRecusada()
            ? 'O responsável recusou a manifestação. Veja os detalhes.'
            : row.status.isConcluida()
              ? 'Adoção concluída — parabéns! 🎉'
              : `A adoção avançou para "${trailLabel(row.status)}".`,
          at: row.updatedAt,
          seen: Date.parse(row.updatedAt) <= Date.parse(lastSeen),
          animalId: row.animalId,
        });
      }
    }

    // 3) Fila local com itens FAILED (conflito/erro permanente): cabe na
    // central — é a lista "pontos que precisam de atenção".
    if (this.extras.syncQueueRepository) {
      try {
        for (const action of await this.extras.syncQueueRepository.listPending()) {
          if (!action.status.isFailed() || action.ownerId !== userId) continue;
          const error = action.lastError ?? '';
          const conflict = error.includes(SYNC_CONFLICT_MARKER) || error.includes(PERMANENT_SYNC_FAILURE_MARKER);
          items.push({
            id: `sync:${action.id}:${action.changedAt}`,
            kind: 'SYNC_FAILED',
            title: conflict ? 'Alteração precisa de revisão' : 'Alteração aguardando envio',
            body: conflict
              ? 'Houve conflito no servidor. Revise nas telas indicadas.'
              : 'Sem envio por falta de conexão — tentaremos novamente no próximo sync.',
            at: action.changedAt,
            seen: Date.parse(action.changedAt) <= Date.parse(lastSeen),
          });
        }
      } catch {
        // fila indísponível: o resto do feed segue
      }
    }

    items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    return { items, unseenCount: items.filter((i) => !i.seen).length };
  }

  /** Abrir a central = marcar lidas (persiste entre aberturas — decisão 20). */
  async markSeen(userId: string, at = new Date().toISOString()): Promise<void> {
    await this.appState.set(notificationsLastSeenKey(userId), at);
  }
}

/** Rótulo da trilha no CORPO do item (texto de conteúdo — não é token). */
function trailLabel(status: InterestStatus): string {
  const labels: Record<string, string> = {
    EM_ANALISE: 'Em análise',
    VISITA_COMBINADA: 'Visita combinada',
    CONCLUIDA: 'Concluída',
    RECUSADA: 'Recusada',
  };
  return labels[status.value] ?? status.value;
}
