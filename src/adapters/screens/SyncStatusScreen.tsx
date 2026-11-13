import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { SyncAction } from '../../domain/entities/SyncAction';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { PhotoStorage } from '../../domain/ports/PhotoStorage';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { FullSyncResult } from '../../application/use-cases/RunFullSyncUseCase';
import { ProcessSyncQueueUseCase } from '../../application/use-cases/ProcessSyncQueueUseCase';
import { getActiveUserId, isVisibleToActiveSession } from '../sync/activeSession';
import { SyncQueueRepositoryFake } from '../../application/fakes/SyncQueueRepositoryFake';
import { AnimalRepositoryFake } from '../../application/fakes/AnimalRepositoryFake';
import {
  listOfflineCapabilities,
  OFFLINE_BEHAVIOR_LABELS,
  OFFLINE_STATUS_LABELS,
} from '../../application/offline/OfflineCapabilities';

export interface SyncStatusScreenProps {
  syncQueueRepository?: SyncQueueRepository;
  animalRepository?: AnimalRepository;
  /** Upload remoto das fotos (só com backend configurado). */
  remotePhotoStorage?: PhotoStorage;
  /** Modo remoto atual do app ('supabase' ou 'none'). */
  remoteMode?: 'supabase' | 'none';
  /** Ciclo completo (envia a fila e atualiza pelo servidor). Padrão: só processa a fila. */
  runSync?: () => Promise<FullSyncResult>;
  /** Abre a revisão de conflitos (RF23). */
  onOpenConflicts?: () => void;
}

export const SyncStatusScreen: React.FC<SyncStatusScreenProps> = ({
  syncQueueRepository = new SyncQueueRepositoryFake(),
  animalRepository = new AnimalRepositoryFake(),
  remotePhotoStorage,
  remoteMode = 'none',
  runSync,
  onOpenConflicts,
}) => {
  const [pending, setPending] = useState<SyncAction[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const loadPending = async () => {
    const items = await syncQueueRepository.listPending();
    // DAT-10: pendências de outra conta ficam na fila, mas não aparecem.
    setPending(items.filter(isVisibleToActiveSession));
  };

  const handleDismissAction = async (actionId: string) => {
    await syncQueueRepository.delete(actionId);
    await loadPending();
  };

  const handleClearPermanentErrors = async () => {
    for (const item of pending) {
      if (item.lastError && item.lastError.includes('ERRO PERMANENTE')) {
        await syncQueueRepository.delete(item.id);
      }
    }
    await loadPending();
  };

  useEffect(() => {
    loadPending();
  }, []);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      let res: FullSyncResult;
      if (runSync) {
        res = await runSync();
      } else {
        const useCase = new ProcessSyncQueueUseCase(
          syncQueueRepository,
          animalRepository,
          undefined,
          remotePhotoStorage,
          { currentUserId: getActiveUserId }
        );
        res = { push: await useCase.execute() };
      }
      const { push, pull, pullError } = res;
      let summary = `Processados: ${push.processedCount} | Sucesso: ${push.successCount} | Falhas: ${push.failedCount}`;
      if (push.conflictCount) summary += ` | Conflitos: ${push.conflictCount}`;
      if (pull) summary += ` | Do servidor: ${pull.added} novos, ${pull.updated} atualizados`;
      if (pullError) summary += ` | Não foi possível ler o servidor: ${pullError}`;
      setLastResult(summary);
      await loadPending();
    } finally {
      setSyncing(false);
    }
  };

  const conflicts = pending.filter((a) => a.isConflict);

  return (
    <View style={styles.container} testID="sync-status-screen">
      <Text style={styles.title}>Status de Sincronização</Text>

      <View style={[styles.modeBadge, remoteMode === 'supabase' ? styles.modeBadgeOnline : styles.modeBadgeOffline]}>
        <Text style={styles.modeBadgeText}>
          {remoteMode === 'supabase'
            ? '🟢 Backend Supabase Conectado'
            : '🟡 Modo Offline Local (SQLite / Sem Supabase)'}
        </Text>
      </View>

      {lastResult && (
        <View style={styles.banner} testID="sync-result-banner">
          <Text style={styles.bannerText}>{lastResult}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
        onPress={handleSyncNow}
        disabled={syncing}
        testID="btn-trigger-sync"
      >
        <Text style={styles.syncBtnText}>
          {syncing ? 'Sincronizando...' : '🔄 Sincronizar Agora'}
        </Text>
      </TouchableOpacity>

      {conflicts.length > 0 && onOpenConflicts && (
        <TouchableOpacity style={styles.conflictBtn} onPress={onOpenConflicts} testID="btn-open-conflicts">
          <Text style={styles.conflictBtnText}>
            ⚠️ {conflicts.length} conflito(s) precisam da sua revisão
          </Text>
        </TouchableOpacity>
      )}

      {pending.some((item) => item.lastError && item.lastError.includes('ERRO PERMANENTE')) && (
        <TouchableOpacity
          style={styles.clearErrorsBtn}
          onPress={handleClearPermanentErrors}
        >
          <Text style={styles.clearErrorsBtnText}>
            🗑️ Limpar itens antigos com erro permanente da fila
          </Text>
        </TouchableOpacity>
      )}

      <Text style={styles.subtitle}>Operações Pendentes ({pending.length})</Text>

      <FlatList
        data={pending}
        keyExtractor={(item) => item.id}
        testID="pending-actions-list"
        ListEmptyComponent={
          <Text style={styles.emptyText} testID="empty-queue-message">
            Nenhuma operação pendente. Todos os dados estão atualizados!
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.itemCard} testID={`sync-item-${item.id}`}>
            <View style={styles.itemCardHeader}>
              <Text style={styles.itemOp}>
                [{item.operation}] Entidade: {item.entityType} ({item.entityId})
              </Text>
              {item.lastError ? (
                <TouchableOpacity
                  onPress={() => handleDismissAction(item.id)}
                  style={styles.dismissBtn}
                >
                  <Text style={styles.dismissBtnText}>Descartar</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <Text style={styles.itemMeta}>
              Tentativas: {item.attempts} | Status: {item.status.value}
            </Text>
            {item.lastError && <Text style={styles.itemError}>Erro: {item.lastError}</Text>}
          </View>
        )}
        ListFooterComponent={
          <View style={styles.footer} testID="offline-capabilities-section">
            <Text style={styles.sectionTitle}>O que funciona offline (RNF01/RF17–RF22)</Text>
            <Text style={styles.statusNote}>
              Estados visíveis: “{OFFLINE_STATUS_LABELS.OFFLINE}”, “{OFFLINE_STATUS_LABELS.SAVED}”,
              “{OFFLINE_STATUS_LABELS.PENDING}”, “{OFFLINE_STATUS_LABELS.SYNCING}” e “
              {OFFLINE_STATUS_LABELS.SYNCED}”.
            </Text>
            {listOfflineCapabilities().map((entry) => (
              <View style={styles.itemCard} key={entry.feature} testID={`capability-${entry.feature}`}>
                <Text style={styles.itemOp}>{entry.label}</Text>
                <Text style={styles.itemMeta}>
                  {entry.rf.join(' · ')} | {entry.behaviorLabel}
                </Text>
                <Text style={styles.itemMeta}>{entry.offlineFlow}</Text>
              </View>
            ))}
            <Text style={styles.footerNote}>
              Favoritos e interesses entram na fila (provisório, aguardando decisão de produto — §4 do
              nextsteps) e sobem quando houver conexão.
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  conflictBtn: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffc107',
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  conflictBtnText: { color: '#856404', fontWeight: 'bold' },
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#f5f5f7',
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#1c1c1e',
  },
  banner: {
    backgroundColor: '#d1ecf1',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  bannerText: {
    color: '#0c5460',
    fontWeight: 'bold',
  },
  syncBtn: {
    backgroundColor: '#0066cc',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  syncBtnDisabled: {
    backgroundColor: '#a5a5a5',
  },
  syncBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#3a3a3c',
  },
  itemCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderColor: '#e5e5ea',
    borderWidth: 1,
  },
  itemOp: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  itemMeta: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  itemError: {
    fontSize: 12,
    color: '#dc3545',
    marginTop: 4,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#28a745',
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3a3a3c',
    marginBottom: 8,
  },
  statusNote: {
    fontSize: 12,
    color: '#666',
    marginBottom: 10,
  },
  footerNote: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#856404',
    marginTop: 8,
  },
  modeBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  modeBadgeOnline: {
    backgroundColor: '#d4edda',
    borderColor: '#c3e6cb',
    borderWidth: 1,
  },
  modeBadgeOffline: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffeeba',
    borderWidth: 1,
  },
  modeBadgeText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#155724',
  },
  clearErrorsBtn: {
    backgroundColor: '#f8d7da',
    borderColor: '#f5c6cb',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  clearErrorsBtnText: {
    color: '#721c24',
    fontSize: 13,
    fontWeight: 'bold',
  },
  itemCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dismissBtn: {
    backgroundColor: '#6c757d',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  dismissBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
