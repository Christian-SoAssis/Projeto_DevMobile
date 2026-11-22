import React, { useCallback, useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/adapters/theme/tokens';
import { useRepositories } from '../../src/adapters/context/RepositoriesContext';
import { useAuth } from '../../src/adapters/context/AuthContext';
import { subscribeNotificationsChanged } from '../../src/adapters/sync/notificationEvents';
import { subscribePullCompleted } from '../../src/adapters/sync/pullEvents';
import {
  interestWithdrawalsKey,
  parseInterestWithdrawalEvents,
} from '../../src/adapters/sync/interestWithdrawalEvents';

export default function TabsLayout() {
  const container = useRepositories();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const computeBadge = useCallback(async () => {
    try {
      const lastSeenIso = (await container.appStateRepository.get('notifications_last_seen')) ?? '';
      const lastSeenMs = lastSeenIso ? Date.parse(lastSeenIso) || 0 : 0;

      const pending = await container.syncQueueRepository.listPending();
      const failedCount = pending.filter(
        (a) => a.status.isFailed() && (!user || !a.ownerId || a.ownerId === user.id)
      ).length;

      let interestEvents = 0;
      if (user) {
        const myInterests = await container.interestRepository.listByUser(user.id);
        for (const item of myInterests) {
          const updatedMs = Date.parse(item.updatedAt) || 0;
          if (updatedMs > lastSeenMs) interestEvents += 1;
        }
        const myAnimals = await container.animalRepository.findByOwner(user.id);
        for (const anim of myAnimals) {
          const received = await container.interestRepository.listByAnimal(anim.id);
          for (const rec of received) {
            const createdMs = Date.parse(rec.createdAt) || 0;
            if (createdMs > lastSeenMs) interestEvents += 1;
          }
        }
        const withdrawals = parseInterestWithdrawalEvents(
          await container.appStateRepository.get(interestWithdrawalsKey(user.id))
        );
        for (const withdrawal of withdrawals) {
          const withdrawnMs = Date.parse(withdrawal.withdrawnAt) || 0;
          if (withdrawnMs > lastSeenMs) interestEvents += 1;
        }
      }

      setUnreadCount(failedCount + interestEvents);
    } catch {
      setUnreadCount(0);
    }
  }, [container, user]);

  useEffect(() => {
    computeBadge();
    const unsub1 = subscribeNotificationsChanged(computeBadge);
    const unsub2 = subscribePullCompleted(computeBadge);
    return () => {
      unsub1();
      unsub2();
    };
  }, [computeBadge]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.terracotta,
        tabBarInactiveTintColor: COLORS.brown,
        tabBarStyle: {
          backgroundColor: COLORS.cream,
          borderTopColor: COLORS.peach,
          borderTopWidth: 1.5,
          height: 66,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '800',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="favoritos"
        options={{
          title: 'Favoritos',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'heart' : 'heart-outline'} size={22} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="meus-anuncios"
        options={{
          title: 'Anúncios',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'megaphone' : 'megaphone-outline'} size={22} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: 'Sync',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'sync-circle' : 'sync-outline'} size={22} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="conta"
        options={{
          title: 'Conta',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={String(color)} />
          ),
        }}
      />
      <Tabs.Screen
        name="notificacoes"
        options={{
          title: 'Avisos',
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: COLORS.terracotta,
            color: COLORS.white,
            fontSize: 10,
            fontWeight: '800',
          },
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'notifications' : 'notifications-outline'}
              size={22}
              color={String(color)}
            />
          ),
        }}
      />
    </Tabs>
  );
}
