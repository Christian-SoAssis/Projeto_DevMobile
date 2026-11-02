import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { User } from '../../domain/entities/User';
import { ModerationEntry } from '../../domain/ports/ModerationGateway';
import { ModerateAnimalUseCase } from '../../application/use-cases/ModerateAnimalUseCase';

export interface ModerationScreenProps {
  actor: User;
  useCase: ModerateAnimalUseCase;
  onSelectAnimal?: (entry: ModerationEntry) => void;
}

/**
 * Moderação de anúncios (UC20, RF27). Ações provisórias: ocultar e reexibir
 * (os tipos definitivos aguardam decisão de produto — §4 do nextsteps). A
 * barreira real é o `ModerateAnimalUseCase` + RLS `is_admin()`; esta tela só
 * é alcançável por administradores.
 */
export const ModerationScreen: React.FC<ModerationScreenProps> = ({ actor, useCase, onSelectAnimal }) => {
  const [entries, setEntries] = useState<ModerationEntry[] | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setEntries(await useCase.list(actor));
    } catch (err: any) {
      setEntries([]);
      setFeedback(err?.message || 'Não foi possível carregar os anúncios.');
    }
  }, [useCase, actor]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (entry: ModerationEntry) => {
    if (busyId) return;
    setBusyId(entry.animal.id);
    setFeedback(null);
    try {
      await useCase.execute(actor, entry.animal.id, entry.hidden ? 'UNHIDE' : 'HIDE');
      setFeedback(entry.hidden ? 'Anúncio reexibido.' : 'Anúncio ocultado da lista pública.');
      await load();
    } catch (err: any) {
      setFeedback(err?.message || 'Não foi possível moderar o anúncio.');
    } finally {
      setBusyId(null);
    }
  };

  if (entries === null) {
    return (
      <View style={styles.center} testID="moderation-loading">
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="moderation-screen">
      <Text style={styles.title}>Moderação de anúncios</Text>
      {feedback && (
        <View style={styles.banner} testID="moderation-feedback">
          <Text style={styles.bannerText}>{feedback}</Text>
        </View>
      )}
      <FlatList
        data={entries}
        keyExtractor={(e) => e.animal.id}
        ListEmptyComponent={
          <Text style={styles.empty} testID="moderation-empty">
            Nenhum anúncio encontrado.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card} testID={`moderation-item-${item.animal.id}`}>
            <TouchableOpacity onPress={() => onSelectAnimal?.(item)} disabled={!onSelectAnimal}>
              <Text style={styles.name}>{item.animal.name}</Text>
              <Text style={styles.meta}>
                {item.animal.characteristics.species} • {item.animal.location.neighborhood},{' '}
                {item.animal.location.city}
              </Text>
            </TouchableOpacity>
            {item.hidden && <Text style={styles.hiddenBadge}>Oculto</Text>}
            <TouchableOpacity
              style={[styles.btn, item.hidden ? styles.btnShow : styles.btnHide]}
              onPress={() => toggle(item)}
              disabled={busyId !== null}
              testID={`moderate-${item.animal.id}`}
            >
              <Text style={styles.btnText}>{item.hidden ? 'Reexibir' : 'Ocultar'}</Text>
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
  title: { fontSize: 20, fontWeight: 'bold', color: '#1c1c1e', marginBottom: 12 },
  banner: { backgroundColor: '#fff3cd', padding: 10, borderRadius: 6, marginBottom: 12 },
  bannerText: { color: '#856404', fontWeight: 'bold' },
  empty: { textAlign: 'center', color: '#8e8e93', marginTop: 24 },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 12 },
  name: { fontSize: 16, fontWeight: 'bold', color: '#1c1c1e' },
  meta: { fontSize: 13, color: '#8e8e93', marginBottom: 6 },
  hiddenBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffe5e5',
    color: '#ff3b30',
    fontWeight: 'bold',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 6,
  },
  btn: { paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnHide: { backgroundColor: '#ff3b30' },
  btnShow: { backgroundColor: '#34c759' },
  btnText: { color: '#fff', fontWeight: 'bold' },
});
