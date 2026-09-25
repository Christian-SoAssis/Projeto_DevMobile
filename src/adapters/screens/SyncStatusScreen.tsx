import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { SyncAction } from '../../domain/entities/SyncAction';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { ProcessSyncQueueUseCase } from '../../application/use-cases/ProcessSyncQueueUseCase';
import { SyncQueueRepositoryFake } from '../../application/fakes/SyncQueueRepositoryFake';
import { AnimalRepositoryFake } from '../../application/fakes/AnimalRepositoryFake';

export interface SyncStatusScreenProps {
  syncQueueRepository?: SyncQueueRepository;
  animalRepository?: AnimalRepository;
}

export const SyncStatusScreen: React.FC<SyncStatusScreenProps> = ({
  syncQueueRepository = new SyncQueueRepositoryFake(),
  animalRepository = new AnimalRepositoryFake(),
}) => {
  const [pending, setPending] = useState<SyncAction[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const loadPending = async () => {
    const items = await syncQueueRepository.listPending();
    setPending(items);
  };

  useEffect(() => {
    loadPending();
  }, []);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const useCase = new ProcessSyncQueueUseCase(syncQueueRepository, animalRepository);
      const res = await useCase.execute();
      setLastResult(
        `Processados: ${res.processedCount} | Sucesso: ${res.successCount} | Falhas: ${res.failedCount}`
      );
      await loadPending();
    } finally {
      setSyncing(false);
    }
  };

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
      />
    </View>
  );
};

const styles = StyleSheet.create({
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
});
