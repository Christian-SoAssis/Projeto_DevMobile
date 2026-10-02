import React from 'react';
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Início' }} />
      <Tabs.Screen name="favoritos" options={{ title: 'Favoritos' }} />
      <Tabs.Screen name="meus-anuncios" options={{ title: 'Meus anúncios' }} />
      <Tabs.Screen name="sync" options={{ title: 'Sync' }} />
    </Tabs>
  );
}
