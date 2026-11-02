import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/adapters/context/AuthContext';
import { canAccess } from '../../src/domain/services/AccessPolicy';

export default function TabsLayout() {
  const { user } = useAuth();
  const role = user?.role ?? null;
  // Abas restritas somem para visitantes (`href: null`); a rota continua
  // protegida por RequireAccess caso alguém chegue por link direto.
  const tabHref = (area: Parameters<typeof canAccess>[1]) => (canAccess(role, area) ? undefined : null);

  return (
    <Tabs
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
    </Tabs>
  );
}
