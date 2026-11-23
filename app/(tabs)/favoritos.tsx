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
import { Animal } from '../../src/domain/entities/Animal';
import { useAuth } from '../../src/adapters/context/AuthContext';
import { useConnectivity } from '../../src/adapters/hooks/useConnectivity';
import { useFullSync } from '../../src/adapters/hooks/useFullSync';
import { useUseCases } from '../../src/adapters/hooks/useUseCases';
import { subscribePullCompleted } from '../../src/adapters/sync/pullEvents';
import { EnlaceHeader } from '../../src/adapters/components/EnlaceHeader';
import { AnimalCard } from '../../src/adapters/components/AnimalCard';
import {
  CLAY_PRIMARY_BUTTON_STYLE,
  COLORS,
} from '../../src/adapters/theme/tokens';

/**
 * V07 • Favoritos ("Guardados no coração" — Prancha 01/02)
 */
export default function FavoritosScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isOnline = useConnectivity();
  const [favoriteAnimals, setFavoriteAnimals] = useState<Animal[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const runFullSync = useFullSync();
  const { toggleFavoriteUseCase, listFavoriteAnimals } = useUseCases();

  const loadFavorites = useCallback(async () => {
    if (!user) {
      setFavoriteAnimals([]);
      return;
    }
    setFavoriteAnimals(await listFavoriteAnimals(user.id));
  }, [listFavoriteAnimals, user]);

  useEffect(() => {
    void loadFavorites();
    const unsub = subscribePullCompleted(() => {
      void loadFavorites();
    });
    return unsub;
  }, [loadFavorites]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const localReload = loadFavorites();
      if (isOnline) {
        await Promise.race([
          runFullSync(),
          new Promise((resolve) => setTimeout(resolve, 800)),
        ]);
      } else {
        await localReload;
      }
    } catch (err) {
      console.warn('Erro ao atualizar favoritos:', err);
    } finally {
      setRefreshing(false);
    }
  }, [isOnline, runFullSync, loadFavorites]);

  const handleRemoveFavorite = async (animalId: string) => {
    if (!user) return;
    await toggleFavoriteUseCase.execute(user.id, animalId, isOnline);
    await loadFavorites();
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EnlaceHeader />
        <View style={styles.guestBox}>
          <Ionicons name="heart-circle-outline" size={64} color={COLORS.terracotta} />
          <Text style={styles.heroTitle}>Guardados no coração</Text>
          <Text style={styles.subtitle}>
            Entre na sua conta para salvar seus animais favoritos e consultá-los mesmo offline.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(public)/login')}
            style={[CLAY_PRIMARY_BUTTON_STYLE, { width: '100%', marginTop: 16 }]}
          >
            <Text style={styles.primaryBtnText}>Entrar na minha conta</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <EnlaceHeader />
      <View style={styles.headerBlock}>
        <View>
          <Text style={styles.heroTitle}>Guardados{'\n'}no coração</Text>
          <Text style={styles.subtitle}>Meus favoritos • {favoriteAnimals.length}</Text>
        </View>
        <View style={styles.heartDecorCircle}>
          <Ionicons name="heart" size={28} color={COLORS.terracotta} />
        </View>
      </View>

      <FlatList
        data={favoriteAnimals}
        keyExtractor={(item) => item.id}
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
            <Ionicons name="heart-outline" size={40} color={COLORS.brownMuted} />
            <Text style={styles.emptyTitle}>Sua lista está vazia</Text>
            <Text style={styles.subtitle}>
              Toque no coração em qualquer anúncio para guardá-lo aqui.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <AnimalCard
            animal={item}
            isFavorite
            onPress={() => router.push(`/animal/${item.id}`)}
            onToggleFavorite={() => handleRemoveFavorite(item.id)}
          />
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
  headerBlock: {
    paddingHorizontal: 18,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.espresso,
    lineHeight: 31,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.brown,
    marginTop: 4,
  },
  heartDecorCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.cream,
    borderWidth: 1.5,
    borderColor: COLORS.peach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 24,
    gap: 12,
  },
  guestBox: {
    flex: 1,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '900',
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.espresso,
  },
});
