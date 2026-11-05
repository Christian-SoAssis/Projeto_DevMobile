import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { Animal } from '../../domain/entities/Animal';
import { ConflictView, ResolveSyncConflictUseCase } from '../../application/use-cases/ResolveSyncConflictUseCase';

export interface ConflictReviewScreenProps {
  useCase: ResolveSyncConflictUseCase;
  /** Chamado depois de resolver, para a tela Sync atualizar o resumo. */
  onResolved?: () => void;
  onBack?: () => void;
}

function describe(animal: Animal | null): string[] {
  if (!animal) return ['(não existe)'];
  return [
    `Nome: ${animal.name}`,
    `Situação: ${animal.status.value === 'ADOPTED' ? 'Adotado' : 'Disponível'}`,
    `Atualizado em: ${new Date(animal.updatedAt).toLocaleString('pt-BR')}`,
    `Versão: ${animal.version}`,
  ];
}

/**
 * Revisão de conflitos de sincronização (RF23, doc §9.4): mostra a edição
 * local ao lado da versão do servidor e deixa o responsável escolher. Nada
 * é descartado sem essa escolha.
 */
export const ConflictReviewScreen: React.FC<ConflictReviewScreenProps> = ({ useCase, onResolved, onBack }) => {
  const [items, setItems] = useState<ConflictView[] | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await useCase.listConflicts());
    } catch {
      setItems([]);
      setFeedback('Não foi possível ler os conflitos agora (sem conexão?).');
    }
  }, [useCase]);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (actionId: string, choice: 'local' | 'remote') => {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      if (choice === 'local') {
        await useCase.keepLocal(actionId);
        setFeedback('Sua edição foi mantida e será enviada na próxima sincronização.');
      } else {
        await useCase.useRemote(actionId);
        setFeedback('A versão do servidor foi aplicada.');
      }
      await load();
      onResolved?.();
    } catch (err: any) {
      setFeedback(err?.message || 'Não foi possível resolver o conflito.');
    } finally {
      setBusy(false);
    }
  };

  if (items === null) {
    return (
      <View style={styles.center} testID="conflicts-loading">
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="conflict-review-screen">
      {onBack && (
        <TouchableOpacity onPress={onBack} testID="conflicts-back">
          <Text style={styles.back}>Voltar</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.title}>Revisão de conflitos</Text>
      {feedback && (
        <View style={styles.banner} testID="conflicts-feedback">
          <Text style={styles.bannerText}>{feedback}</Text>
        </View>
      )}
      <FlatList
        data={items}
        keyExtractor={(v) => v.action.id}
        ListEmptyComponent={
          <Text style={styles.empty} testID="conflicts-empty">
            Nenhum conflito para revisar.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card} testID={`conflict-${item.action.id}`}>
            <Text style={styles.reason}>{item.action.lastError}</Text>
            <View style={styles.columns}>
              <View style={styles.column}>
                <Text style={styles.colTitle}>Sua edição</Text>
                {describe(item.local).map((line) => (
                  <Text key={line} style={styles.line}>{line}</Text>
                ))}
              </View>
              <View style={styles.column}>
                <Text style={styles.colTitle}>No servidor</Text>
                {describe(item.remote).map((line) => (
                  <Text key={line} style={styles.line}>{line}</Text>
                ))}
              </View>
            </View>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => resolve(item.action.id, 'local')}
              disabled={busy}
              testID={`keep-local-${item.action.id}`}
            >
              <Text style={styles.btnText}>
                {item.remote ? 'Manter minha edição' : 'Recriar o anúncio'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={() => resolve(item.action.id, 'remote')}
              disabled={busy}
              testID={`use-remote-${item.action.id}`}
            >
              <Text style={styles.btnSecondaryText}>
                {item.remote ? 'Usar a versão do servidor' : 'Descartar minha edição'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'column', backgroundColor: '#f5f5f7', padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  back: { color: '#0066cc', fontWeight: 'bold', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1c1c1e', marginBottom: 12 },
  banner: { backgroundColor: '#fff3cd', padding: 10, borderRadius: 6, marginBottom: 12 },
  bannerText: { color: '#856404', fontWeight: 'bold' },
  empty: { textAlign: 'center', color: '#8e8e93', marginTop: 24 },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 12 },
  reason: { color: '#856404', marginBottom: 8 },
  columns: { flexDirection: 'row', marginBottom: 8 },
  column: { flex: 1, paddingRight: 8 },
  colTitle: { fontWeight: 'bold', marginBottom: 4, color: '#1c1c1e' },
  line: { fontSize: 13, color: '#48484a', marginBottom: 2 },
  btn: { paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  btnPrimary: { backgroundColor: '#0066cc' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  btnSecondary: { borderColor: '#0066cc', borderWidth: 1 },
  btnSecondaryText: { color: '#0066cc', fontWeight: 'bold' },
});
