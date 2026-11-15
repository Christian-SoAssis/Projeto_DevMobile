import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Animal } from '../../src/domain/entities/Animal';
import { ToggleFavoriteUseCase } from '../../src/application/use-cases/ToggleFavoriteUseCase';
import { useRepositories } from '../../src/adapters/context/RepositoriesContext';
import { useAuth } from '../../src/adapters/context/AuthContext';
import { useConnectivity } from '../../src/adapters/hooks/useConnectivity';
import { subscribePullCompleted } from '../../src/adapters/sync/pullEvents';
import { EnlaceHeader } from '../../src/adapters/components/EnlaceHeader';
import {
  CLAY_CARD_STYLE,
  CLAY_PRIMARY_BUTTON_STYLE,
  COLORS,
  RADII,
} from '../../src/adapters/theme/tokens';

const FALLBACK_PHOTO = 'https://images.unsplash.com/photo-1543466835-00a7907e9de1';

/**
 * V07 • Favoritos ("Guardados no coração" — Prancha 01/02)
 */
export default function FavoritosScreen() {
  const router = useRouter();
  const container = useRepositories();
  const { user } = useAuth();
  const isOnline = useConnectivity();
  const [favoriteAnimals, setFavoriteAnimals] = useState<Animal[]>([]);

  const toggleFavoriteUseCase = useMemo(
    () =>
      new ToggleFavoriteUseCase(
        container.favoriteRepository,
        container.syncQueueRepository,
        container.remoteFavorites
      ),
    [container]
  );

  const loadFavorites = useCallback(async () => {
    if (!user) {
      setFavoriteAnimals([]);
      return;
    }
    const favs = await container.favoriteRepository.listByUser(user.id);
    const loaded: Animal[] = [];
    for (const fav of favs) {
      const anim = await container.animalRepository.findById(fav.animalId);
      if (anim) loaded.push(anim);
    }
    setFavoriteAnimals(loaded);
  }, [container, user]);

  useEffect(() => {
    loadFavorites();
    const unsub = subscribePullCompleted(loadFavorites);
    return unsub;
  }, [loadFavorites]);

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
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push(`/animal/${item.id}`)}
            style={styles.card}
          >
            <Image
              source={{ uri: item.photos[0]?.displayUri || FALLBACK_PHOTO }}
              style={styles.thumb}
            />
            <View style={{ flex: 1 }}>
              <View style={styles.cardTopRow}>
                <Text style={styles.animalName}>{item.name}</Text>
                <TouchableOpacity onPress={() => handleRemoveFavorite(item.id)}>
                  <Ionicons name="heart" size={22} color={COLORS.terracotta} />
                </TouchableOpacity>
              </View>
              <View style={styles.badgeAvailable}>
                <Text style={styles.badgeText}>
                  {item.status.isAvailable() ? 'Disponível' : 'Adotado'}
                </Text>
              </View>
              <Text style={styles.metaText}>
                🐾 {item.characteristics.approximateAge} • {item.characteristics.sex} •{' '}
                {item.characteristics.size}
              </Text>
              <Text style={styles.locationText}>📍 {item.location.displayLabel}</Text>
            </View>
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
  card: {
    ...CLAY_CARD_STYLE,
    flexDirection: 'row',
    padding: 12,
    gap: 12,
    alignItems: 'center',
  },
  thumb: {
    width: 96,
    height: 96,
    borderRadius: 18,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  animalName: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.espresso,
  },
  badgeAvailable: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.green,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADII.pill,
    marginVertical: 4,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
  },
  metaText: {
    fontSize: 12,
    color: COLORS.brown,
    fontWeight: '700',
  },
  locationText: {
    fontSize: 12,
    color: COLORS.espresso,
    fontWeight: '800',
    marginTop: 2,
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
