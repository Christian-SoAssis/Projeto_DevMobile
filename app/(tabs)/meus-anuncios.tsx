import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import { DeleteAnimalUseCase } from '../../src/application/use-cases/DeleteAnimalUseCase';
import { MarkAnimalAdoptedUseCase } from '../../src/application/use-cases/MarkAnimalAdoptedUseCase';
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
 * V09 • Meus anúncios ("Histórias que você cuida" — Prancha 02/02)
 */
export default function MeusAnunciosScreen() {
  const router = useRouter();
  const container = useRepositories();
  const { user } = useAuth();
  const isOnline = useConnectivity();

  const [myAnimals, setMyAnimals] = useState<Animal[]>([]);
  const [pendingAnimalIds, setPendingAnimalIds] = useState<Set<string>>(new Set());

  const deleteUseCase = useMemo(
    () =>
      new DeleteAnimalUseCase(
        container.animalRepository,
        container.syncQueueRepository,
        container.remoteAnimalSource
      ),
    [container]
  );

  const markAdoptedUseCase = useMemo(
    () =>
      new MarkAnimalAdoptedUseCase(
        container.animalRepository,
        container.syncQueueRepository,
        container.remoteAnimalSource
      ),
    [container]
  );

  const loadMyAnimals = useCallback(async () => {
    if (!user) {
      setMyAnimals([]);
      setPendingAnimalIds(new Set());
      return;
    }
    const list = await container.animalRepository.findByOwner(user.id);
    setMyAnimals(list);

    const pending = await container.syncQueueRepository.listPending();
    setPendingAnimalIds(
      new Set(pending.filter((p) => p.entityType === 'animal').map((p) => p.entityId))
    );
  }, [container, user]);

  useEffect(() => {
    loadMyAnimals();
    const unsub = subscribePullCompleted(loadMyAnimals);
    return unsub;
  }, [loadMyAnimals]);

  const handleMarkAdopted = async (animal: Animal) => {
    if (!user) return;
    try {
      await markAdoptedUseCase.execute(animal.id, user.id, isOnline);
      await loadMyAnimals();
    } catch (err) {
      Alert.alert('Atenção', err instanceof Error ? err.message : 'Erro ao marcar como adotado.');
    }
  };

  const handleDelete = (animal: Animal) => {
    if (!user) return;
    Alert.alert(
      'Excluir anúncio',
      `Deseja excluir o anúncio de ${animal.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUseCase.execute(animal.id, user.id, isOnline);
              await loadMyAnimals();
            } catch (err) {
              Alert.alert('Erro', err instanceof Error ? err.message : 'Falha ao excluir.');
            }
          },
        },
      ]
    );
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EnlaceHeader />
        <View style={styles.guestBox}>
          <Ionicons name="megaphone-outline" size={60} color={COLORS.terracotta} />
          <Text style={styles.heroTitle}>Histórias que você cuida</Text>
          <Text style={styles.subtitle}>
            Entre na sua conta para publicar anúncios de adoção e acompanhar interessados.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(public)/login')}
            style={[CLAY_PRIMARY_BUTTON_STYLE, { width: '100%', marginTop: 16 }]}
          >
            <Text style={styles.primaryBtnText}>Entrar para anunciar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <EnlaceHeader />

      <View style={styles.topBlock}>
        <Text style={styles.heroTitle}>Histórias que{'\n'}você cuida</Text>
        <Text style={styles.subtitle}>Meus anúncios • {myAnimals.length}</Text>

        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => router.push('/(protected)/novo-anuncio')}
          style={[CLAY_PRIMARY_BUTTON_STYLE, { marginTop: 12 }]}
        >
          <Ionicons name="add" size={20} color={COLORS.white} style={{ marginRight: 6 }} />
          <Text style={styles.primaryBtnText}>Novo anúncio</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={myAnimals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="paw-outline" size={38} color={COLORS.brownMuted} />
            <Text style={styles.emptyTitle}>Você ainda não criou anúncios</Text>
            <Text style={styles.subtitle}>
              Toque em "+ Novo anúncio" para cadastrar um animal para adoção.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isPendingLocal = pendingAnimalIds.has(item.id);
          return (
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={() => router.push(`/animal/${item.id}`)}
              style={styles.card}
            >
              <Image
                source={{ uri: item.photos[0]?.displayUri || FALLBACK_PHOTO }}
                style={styles.thumb}
              />
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.animalName}>{item.name}</Text>
                  {isPendingLocal && (
                    <View style={styles.savedOnDeviceChip}>
                      <Ionicons name="phone-portrait-outline" size={11} color={COLORS.brown} />
                      <Text style={styles.savedOnDeviceText}>Salvo no aparelho</Text>
                    </View>
                  )}
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    !item.status.isAvailable() && styles.statusBadgeAdopted,
                  ]}
                >
                  <Text style={styles.statusBadgeText}>
                    {item.status.isAvailable() ? 'Disponível' : 'Adotado'}
                  </Text>
                </View>

                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    onPress={() => router.push(`/(protected)/editar-anuncio/${item.id}`)}
                    style={styles.actionPill}
                  >
                    <Text style={styles.actionPillText}>Editar</Text>
                  </TouchableOpacity>

                  {item.status.isAvailable() && (
                    <TouchableOpacity
                      onPress={() => handleMarkAdopted(item)}
                      style={styles.actionPill}
                    >
                      <Text style={styles.actionPillText}>Adotado</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={() => handleDelete(item)}
                    style={styles.actionPill}
                  >
                    <Text style={[styles.actionPillText, { color: COLORS.danger }]}>
                      Excluir
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.ivory,
  },
  topBlock: {
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
    fontWeight: '700',
    color: COLORS.brown,
    marginTop: 4,
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '900',
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
    width: 92,
    height: 92,
    borderRadius: 18,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  animalName: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.espresso,
  },
  savedOnDeviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F7E5D2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADII.pill,
  },
  savedOnDeviceText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.brown,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.green,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADII.pill,
    marginVertical: 6,
  },
  statusBadgeAdopted: {
    backgroundColor: '#6E8B63',
  },
  statusBadgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  actionPill: {
    backgroundColor: COLORS.ivory,
    borderWidth: 1,
    borderColor: COLORS.peach,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: RADII.pill,
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.espresso,
  },
  guestBox: {
    flex: 1,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
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
