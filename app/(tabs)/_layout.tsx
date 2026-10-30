import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
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
          title: 'Favoritos',
        tabBarIcon: ({ focused, size }) => (
          <Ionicons name="heart-outline" size={size} color={focused ? '#0066cc' : '#8e8e93'} />
        ),
        }}
      />
      <Tabs.Screen
        name="meus-anuncios"
        options={{
          title: 'Meus anúncios',
        tabBarIcon: ({ focused, size }) => (
          <Ionicons name="paw-outline" size={size} color={focused ? '#0066cc' : '#8e8e93'} />
        ),
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: 'Sync',
        tabBarIcon: ({ focused, size }) => (
          <Ionicons name="sync-outline" size={size} color={focused ? '#0066cc' : '#8e8e93'} />
        ),
        }}
      />
    </Tabs>
  );
}
