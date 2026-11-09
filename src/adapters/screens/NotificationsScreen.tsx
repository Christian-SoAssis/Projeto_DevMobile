import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { BuildNotificationsUseCase, NotificationItem } from '../../application/use-cases/BuildNotificationsUseCase';
import { notifyNotificationsChanged } from '../sync/notificationEvents';

export interface NotificationsScreenProps {
  refreshToken?: number;
  userId: string | null;
  /** Feed derivado (decisão 20) — montado na rota pelo container. */
  useCase: BuildNotificationsUseCase;
  onBack?: () => void;
  /** Abrir um item navega (ex.: detalhes do anúncio — item.animalId). */
  onOpenItem?: (item: NotificationItem) => void;
}

const KIND_LABELS: Record<NotificationItem['kind'], string> = {
  INTEREST_RECEIVED: '🐾 Interesse',
  STATUS_CHANGED: '📈 Trilha de adoção',
  SYNC_FAILED: '⚠️ Sincronização',
};

/**
 * Central de notificações in-app (melhoria #7, decisão 20). SEM push
 * (sem expo-notifications): feed derivado dos dados reais; abrir a central
 * grava notifications_last_seen (persistido no aparelho) e zera o badge do
 * sino — o hook do tab emite de novo pelo canal `notificationEvents`.
 */
export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  refreshToken = 0,
  userId,
  useCase,
  onBack,
  onOpenItem,
}) => {
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [unseen, setUnseen] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let active = true;

    async function load() {
      try {
        // 1) Lê com o cutoff ANTES de marcar: a contagem vista agora é a que o
        // sino mostrava; 2) grava o last_seen já — decisão 20 ("abrir a central
        // grava notifications_last_seen e zera o badge"); 3) reemite o canal
        // para o layout do tab recalcular (vai zerar) o badge.
        const openedAt = new Date().toISOString();
        const feed = await useCase.execute(userId!);
        if (!active) return;
        await useCase.markSeen(userId!, openedAt);
        notifyNotificationsChanged();
        if (active) {
          setItems(feed.items);
          setUnseen(feed.unseenCount);
        }
      } catch {
        if (active) setItems([]); // falha de leitura: central vazia, quebra não
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [userId, useCase, refreshToken]);

  if (!userId) {
    return (
      <View style={styles.empty} testID="notifications-visitor">
        <Text style={styles.emptyTitle}>Notificações</Text>
        <Text style={styles.emptyBody}>
          Entre na sua conta para acompanhar interesses nos seus anúncios, etapas
          das suas manifestações e pendências de sincronização.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} testID="notifications-screen">
      {onBack && (
        <TouchableOpacity style={styles.backButton} onPress={onBack} testID="notifications-back">
          <Text style={styles.backText}>‹ Voltar</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.title} testID="notifications-title">
        Notificações{unseen > 0 ? ` (${unseen} novas)` : ''}
      </Text>

      {items === null && <Text style={styles.emptyBody}>Carregando…</Text>}

      {items !== null && items.length === 0 && (
        <Text style={styles.emptyBody} testID="notifications-empty">
          Nada por aqui ainda. Interesses nos seus anúncios, mudanças na trilha das
          suas manifestações e pendências de envio aparecem nesta central.
        </Text>
      )}

      {items !== null &&
        items.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.card, !item.seen && styles.cardUnseen]}
            onPress={() => onOpenItem?.(item)}
            testID={`notification-${item.id}`}
          >
            <Text style={styles.kind}>{KIND_LABELS[item.kind]}</Text>
            <Text style={styles.cardTitle} testID={`notification-${item.id}-title`}>
              {item.title}
            </Text>
            <Text style={styles.cardBody}>{item.body}</Text>
            <Text style={styles.at}>{new Date(item.at).toLocaleString('pt-BR')}</Text>
          </TouchableOpacity>
        ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f7', padding: 16 },
  empty: { flex: 1, backgroundColor: '#f5f5f7', padding: 16 },
  backText: { fontSize: 16, color: '#0066cc', fontWeight: 'bold', marginBottom: 12 },
  backButton: { marginBottom: 12 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1c1c1e', marginBottom: 12 },
  emptyBody: { color: '#5b6773', fontSize: 15, marginBottom: 8 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: '#1c1c1e', marginBottom: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderColor: '#e5e5ea',
    borderWidth: 1,
  },
  cardUnseen: { backgroundColor: '#eef4ff', borderColor: '#c9dbff' },
  kind: { fontSize: 12, color: '#5b6773', marginBottom: 2 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#1c1c1e', marginBottom: 2 },
  cardBody: { fontSize: 13, color: '#48484a', marginBottom: 4 },
  at: { fontSize: 11, color: '#8e8e93' },
});
