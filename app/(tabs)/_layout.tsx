import React, { useMemo } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../src/adapters/context/AuthContext';
import { canAccess } from '../../src/domain/services/AccessPolicy';
import { useRepositories } from '../../src/adapters/context/RepositoriesContext';
import { BuildNotificationsUseCase } from '../../src/application/use-cases/BuildNotificationsUseCase';
import { useUnseenNotifications } from '../../src/adapters/hooks/useUnseenNotifications';

export default function TabsLayout() {
  const { user } = useAuth();
  const role = user?.role ?? null;
  // Abas restritas somem para visitantes (`href: null`); a rota continua
  // protegida por RequireAccess caso alguém chegue por link direto.
  const tabHref = (area: Parameters<typeof canAccess>[1]) => (canAccess(role, area) ? undefined : null);
  const { appStateRepository, animalRepository, interestRepository, remoteInterests, syncQueueRepository } =
    useRepositories();

  const notifications = useMemo(() => new BuildNotificationsUseCase(appStateRepository, {
    animalRepository,
    localInterests: interestRepository,
    remoteInterests,
    syncQueueRepository,
  }), [appStateRepository, animalRepository, interestRepository, remoteInterests, syncQueueRepository]);
  const unseenNotifications = useUnseenNotifications(
    appStateRepository ? notifications : undefined,
    user?.id ?? null
  );

  return (
    <Tabs
      // backBehavior="history": voltar dentro das abas prioriza as abas já
      // visitadas (ordem real de uso) — parte da correção do bug "voltar de
      // pet/formulário caía no Início" (o outro lado é o outer Stack na raiz).
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#0066cc',
        tabBarInactiveTintColor: '#8e8e93',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e5e5ea',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
        tabBarIcon: ({ focused, size }) => (
          <Ionicons name="search-outline" size={size} color={focused ? '#0066cc' : '#8e8e93'} />
        ),
        }}
      />
      <Tabs.Screen
        name="favoritos"
        options={{
          href: tabHref('FAVORITES'),
          title: 'Favoritos',
        tabBarIcon: ({ focused, size }) => (
          <Ionicons name="heart-outline" size={size} color={focused ? '#0066cc' : '#8e8e93'} />
        ),
        }}
      />
      <Tabs.Screen
        name="meus-anuncios"
        options={{
          href: tabHref('MY_ANIMALS'),
          title: 'Meus anúncios',
        tabBarIcon: ({ focused, size }) => (
          <Ionicons name="paw-outline" size={size} color={focused ? '#0066cc' : '#8e8e93'} />
        ),
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          href: tabHref('SYNC'),
          title: 'Sync',
        tabBarIcon: ({ focused, size }) => (
          <Ionicons name="sync-outline" size={size} color={focused ? '#0066cc' : '#8e8e93'} />
        ),
        }}
      />
      <Tabs.Screen
        name="moderacao"
        options={{
          href: tabHref('MODERATION'),
          title: 'Moderação',
          tabBarIcon: ({ focused, size }) => (
            <Ionicons name="shield-checkmark-outline" size={size} color={focused ? '#0066cc' : '#8e8e93'} />
          ),
        }}
      />
      <Tabs.Screen
        name="conta"
        options={{
          title: user ? 'Conta' : 'Entrar',
          tabBarIcon: ({ focused, size }) => (
            <Ionicons name="person-outline" size={size} color={focused ? '#0066cc' : '#8e8e93'} />
          ),
        }}
      />
      <Tabs.Screen
        name="notificacoes"
        options={{
          title: 'Notificações',
          // Badge persistido no aparelho (decisão 20): sobrevive a reinícios;
          // abrir a central zera. Some quando não há novas.
          tabBarBadge: unseenNotifications > 0 ? unseenNotifications : undefined,
          tabBarBadgeStyle: { backgroundColor: '#c62828', color: '#fff' },
          tabBarIcon: ({ focused, size }) => (
            <Ionicons name="notifications-outline" size={size} color={focused ? '#0066cc' : '#8e8e93'} />
          ),
        }}
      />
    </Tabs>
  );
}
