import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRepositories } from '../../src/adapters/context/RepositoriesContext';
import { useAuth } from '../../src/adapters/context/AuthContext';
import { useConnectivity } from '../../src/adapters/hooks/useConnectivity';
import { useFullSync } from '../../src/adapters/hooks/useFullSync';
import { notifyNotificationsChanged } from '../../src/adapters/sync/notificationEvents';
import { EnlaceHeader } from '../../src/adapters/components/EnlaceHeader';
import { CLAY_CARD_STYLE, COLORS } from '../../src/adapters/theme/tokens';

interface FeedItem {
  id: string;
  title: string;
  subtitle: string;
  timestamp: string;
  icon: 'heart' | 'paw' | 'warning';
  targetRoute: string;
}

/**
 * Decisão 20 (08/11/2026): Central de Notificações In-App + badge persistido em `app_state`.
 */
export default function NotificacoesScreen() {
  const router = useRouter();
  const container = useRepositories();
  const { user } = useAuth();
  const isOnline = useConnectivity();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const runFullSync = useFullSync();

  const loadFeed = useCallback(async () => {
    const feed: FeedItem[] = [];

    // 1. Falhas na fila local
    const pending = await container.syncQueueRepository.listPending();
    for (const action of pending) {
      if (action.status.isFailed() && (!user || !action.ownerId || action.ownerId === user.id)) {
        feed.push({
          id: `fail_${action.id}`,
          title: 'Sincronização requer atenção',
          subtitle: action.lastError || 'Toque para abrir a tela de sincronização.',
          timestamp: action.changedAt,
          icon: 'warning',
          targetRoute: '/(tabs)/sync',
        });
      }
    }

    if (user) {
      // 2. Minhas manifestações de interesse (acompanhamento da trilha)
      const myInterests = await container.interestRepository.listByUser(user.id);
      for (const interest of myInterests) {
        const anim = await container.animalRepository.findById(interest.animalId);
        feed.push({
          id: `my_int_${interest.id}`,
          title: `Trilha de adoção • ${anim?.name || 'Pet'}`,
          subtitle: `Etapa atual: ${interest.status.replace('_', ' ')}`,
          timestamp: interest.updatedAt,
          icon: 'paw',
          targetRoute: `/animal/${interest.animalId}`,
        });
      }

      // 3. Interesses recebidos nos meus anúncios
      const myAnimals = await container.animalRepository.findByOwner(user.id);
      for (const anim of myAnimals) {
        const received = await container.interestRepository.listByAnimal(anim.id);
        for (const rec of received) {
          feed.push({
            id: `rec_int_${rec.id}`,
            title: `Novo interessado em ${anim.name}`,
            subtitle: `${rec.userName || 'Adotante'} (${rec.contactInfo || 'ver contato'})`,
            timestamp: rec.createdAt,
            icon: 'heart',
            targetRoute: `/animal/${anim.id}`,
          });
        }
      }
    }

    feed.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
    setItems(feed);

    // Grava `notifications_last_seen` e zera o badge (Decisão 20)
    await container.appStateRepository.set('notifications_last_seen', new Date().toISOString());
    notifyNotificationsChanged();
  }, [container, user]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const localReload = loadFeed();
      if (isOnline) {
        await Promise.race([
          runFullSync(),
          new Promise((resolve) => setTimeout(resolve, 800)),
        ]);
      } else {
        await localReload;
      }
    } catch (err) {
      console.warn('Erro ao atualizar notificações:', err);
    } finally {
      setRefreshing(false);
    }
  }, [isOnline, runFullSync, loadFeed]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <EnlaceHeader />
      <View style={styles.headerBox}>
        <Text style={styles.heroTitle}>Central de{'\n'}Notificações</Text>
        <Text style={styles.subtitle}>
          Acompanhe interesses recebidos, etapas da trilha de adoção e avisos de sincronização.
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.terracotta]}
            tintColor={COLORS.terracotta}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="notifications-off-outline" size={38} color={COLORS.brownMuted} />
            <Text style={styles.emptyTitle}>Nenhuma novidade por enquanto</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(item.targetRoute as any)}
            style={styles.card}
          >
            <View style={styles.iconCircle}>
              <Ionicons
                name={
                  item.icon === 'warning'
                    ? 'warning-outline'
                    : item.icon === 'heart'
                    ? 'heart'
                    : 'paw'
                }
                size={20}
                color={item.icon === 'warning' ? COLORS.amber : COLORS.terracotta}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.brown} />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.ivory,
  },
  headerBox: {
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.espresso,
    lineHeight: 31,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.brown,
    fontWeight: '600',
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 24,
    gap: 10,
  },
  card: {
    ...CLAY_CARD_STYLE,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.ivory,
    borderWidth: 1,
    borderColor: COLORS.peach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.espresso,
  },
  cardSubtitle: {
    fontSize: 13,
    color: COLORS.brown,
    marginTop: 2,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 54,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.espresso,
  },
});
