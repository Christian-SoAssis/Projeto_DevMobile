/**
 * Mapeamento formal das funcionalidades do app no modo offline
 * (RNF01, RF17–RF22; passo "Banco de dados local seguro e offline-first").
 *
 * Este módulo é a referência única (tabela no código) de "funcionalidade →
 * comportamento sem internet". É puro: sem React, Expo, SQLite ou Supabase.
 * A referência visual dos estados (RF22) é `OFFLINE_STATUS_LABELS`, e a tela
 * de Sync lista estas capacidades para o usuário.
 *
 * Favoritos e interesses entram na fila de sincronização (implementação
 * PROVISÓRIA: a decisão de produto sobre "offline completo" segue em aberto
 * no §4 do nextsteps).
 */

export type OfflineBehavior =
  /** Funciona 100% offline a partir do cache/SQLite (RF17). */
  | 'FULL_OFFLINE'
  /** Funciona offline e registra a alteração na fila de sincronização (RF18/RF19). */
  | 'OFFLINE_WITH_QUEUE'
  /** Consulta/registro local funcionam; envio remoto depende de decisão (§4). */
  | 'OFFLINE_PARTIAL'
  /** Exige rede (envio da fila, backend remoto). */
  | 'ONLINE_ONLY';

export const OFFLINE_BEHAVIOR_LABELS: Record<OfflineBehavior, string> = {
  FULL_OFFLINE: 'Funciona offline (cache local)',
  OFFLINE_WITH_QUEUE: 'Funciona offline e entra na fila de sincronização',
  OFFLINE_PARTIAL: 'Salvo localmente — sincronização a decidir (§4)',
  ONLINE_ONLY: 'Exige internet',
};

export interface OfflineCapability {
  /** Nome legível da funcionalidade para exibição na UI. */
  label: string;
  /** Requisitos funcionais da documentação que a entrada representa. */
  rf: string[];
  behavior: OfflineBehavior;
  /** Como a funcionalidade se comporta sem internet. */
  offlineFlow: string;
}

export type OfflineFeatureName =
  | 'busca_anuncios'
  | 'detalhes_anuncio'
  | 'meus_anuncios'
  | 'favoritos_listar'
  | 'favoritar_animal'
  | 'interesse_adocao'
  | 'criar_anuncio'
  | 'editar_anuncio'
  | 'excluir_anuncio'
  | 'marcar_adotado'
  | 'adicionar_foto'
  | 'fila_sincronizacao'
  | 'enviar_sincronizacao'
  | 'autenticacao';

export const OFFLINE_CAPABILITIES: Record<OfflineFeatureName, OfflineCapability> = {
  busca_anuncios: {
    label: 'Buscar anúncios',
    rf: ['RF03', 'RF17'],
    behavior: 'FULL_OFFLINE',
    offlineFlow: 'Busca servida do cache SQLite; banner "Modo Offline" visível (RF22).',
  },
  detalhes_anuncio: {
    label: 'Ver detalhes do anúncio',
    rf: ['RF06', 'RF17'],
    behavior: 'FULL_OFFLINE',
    offlineFlow: 'Detalhes abertos do cache local, incluindo fotos salvas no dispositivo.',
  },
  meus_anuncios: {
    label: 'Meus anúncios',
    rf: ['RF13', 'RF17'],
    behavior: 'FULL_OFFLINE',
    offlineFlow: 'Lista lida do SQLite — anúncios próprios sobrevivem ao reinício.',
  },
  favoritos_listar: {
    label: 'Listar favoritos',
    rf: ['RF15', 'RF17'],
    behavior: 'FULL_OFFLINE',
    offlineFlow: 'Favoritos persistem no SQLite local e abrem sem internet.',
  },
  favoritar_animal: {
    label: 'Favoritar animal',
    rf: ['RF14'],
    behavior: 'OFFLINE_WITH_QUEUE',
    offlineFlow:
      'Registro gravado no SQLite e ação na fila; sobe ao servidor quando houver conexão (favoritar e desfavoritar antes de sincronizar se anulam).',
  },
  interesse_adocao: {
    label: 'Demonstrar interesse em adotar',
    rf: ['RF16'],
    behavior: 'OFFLINE_WITH_QUEUE',
    offlineFlow:
      'Interesse gravado no SQLite e ação na fila; sobe com o contato do interessado quando houver conexão.',
  },
  criar_anuncio: {
    label: 'Criar anúncio',
    rf: ['RF08', 'RF18', 'RF19'],
    behavior: 'OFFLINE_WITH_QUEUE',
    offlineFlow:
      'Anúncio salvo no SQLite e ação CREATE registrada na fila sync_queue (outbox atômico).',
  },
  editar_anuncio: {
    label: 'Editar anúncio',
    rf: ['RF10', 'RF18', 'RF19'],
    behavior: 'OFFLINE_WITH_QUEUE',
    offlineFlow: 'Edição local via UPDATE + item de fila para sincronizar depois.',
  },
  excluir_anuncio: {
    label: 'Excluir anúncio',
    rf: ['RF11', 'RF19'],
    behavior: 'OFFLINE_WITH_QUEUE',
    offlineFlow: 'Exclusão local imediata + item de fila DELETE para o remoto.',
  },
  marcar_adotado: {
    label: 'Marcar como adotado',
    rf: ['RF12', 'RF19'],
    behavior: 'OFFLINE_WITH_QUEUE',
    offlineFlow: 'Status local atualizado + item de fila para o remoto.',
  },
  adicionar_foto: {
    label: 'Adicionar foto ao anúncio',
    rf: ['RF09', 'RF26'],
    behavior: 'OFFLINE_WITH_QUEUE',
    offlineFlow:
      'Imagem fica no dispositivo (local_images) até o upload ser possível — sem perda silenciosa.',
  },
  fila_sincronizacao: {
    label: 'Consultar fila de sincronização',
    rf: ['RF19', 'RF21'],
    behavior: 'FULL_OFFLINE',
    offlineFlow: 'Fila local visível a qualquer momento (tela Sync); envio exige rede.',
  },
  enviar_sincronizacao: {
    label: 'Enviar sincronização ao servidor',
    rf: ['RF20', 'RF22'],
    behavior: 'ONLINE_ONLY',
    offlineFlow: 'Sem internet a fila permanece pendente e é reenviada na reconexão (RF21).',
  },
  autenticacao: {
    label: 'Entrar / criar conta',
    rf: ['RF07'],
    behavior: 'ONLINE_ONLY',
    offlineFlow:
      'Na fase atual é um stub local (gateway fake); com o backend real, exigirá rede.',
  },
};

/**
 * Estados exigidos por RF22/RNF07 com rótulo visual inequívoco:
 * offline, salvo no dispositivo, pendente, sincronizando e atualizado.
 */
export type OfflineSyncState = 'OFFLINE' | 'SAVED' | 'PENDING' | 'SYNCING' | 'SYNCED';

export const OFFLINE_STATUS_LABELS: Record<OfflineSyncState, string> = {
  OFFLINE: 'Modo Offline — Exibindo anúncios em cache',
  SAVED: 'Salvo no dispositivo',
  PENDING: 'Pendente de sincronização',
  SYNCING: 'Sincronizando…',
  SYNCED: 'Atualizado',
};

export function getOfflineCapability(feature: OfflineFeatureName): OfflineCapability {
  return OFFLINE_CAPABILITIES[feature];
}

export interface OfflineCapabilityEntry {
  feature: OfflineFeatureName;
  label: string;
  rf: string[];
  behavior: OfflineBehavior;
  behaviorLabel: string;
  offlineFlow: string;
}

/** Lista pronta para a referência do usuário na UI (tela Sync). */
export function listOfflineCapabilities(): OfflineCapabilityEntry[] {
  return (Object.keys(OFFLINE_CAPABILITIES) as OfflineFeatureName[]).map((feature) => {
    const capability = OFFLINE_CAPABILITIES[feature];
    return {
      feature,
      label: capability.label,
      rf: capability.rf,
      behavior: capability.behavior,
      behaviorLabel: OFFLINE_BEHAVIOR_LABELS[capability.behavior],
      offlineFlow: capability.offlineFlow,
    };
  });
}
