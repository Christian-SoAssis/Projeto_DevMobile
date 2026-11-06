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
  /** Ciclo completo (envia a fila e atualiza pelo servidor). Padrão: só processa a fila. */
  runSync?: () => Promise<FullSyncResult>;
  /** Abre a revisão de conflitos (RF23). */
  onOpenConflicts?: () => void;
}

export const SyncStatusScreen: React.FC<SyncStatusScreenProps> = ({
  syncQueueRepository = new SyncQueueRepositoryFake(),
  animalRepository = new AnimalRepositoryFake(),
  remotePhotoStorage,
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
      <Text style={styles.title}>Status de Sincronização Offline</Text>

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
            <Text style={styles.itemOp}>
              [{item.operation}] Entidade: {item.entityType} ({item.entityId})
            </Text>
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
});
