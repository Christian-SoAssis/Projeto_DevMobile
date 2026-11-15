import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRepositories } from '../../../src/adapters/context/RepositoriesContext';
import { useFullSync } from '../../../src/adapters/hooks/useFullSync';
import { EnlaceHeader } from '../../../src/adapters/components/EnlaceHeader';
import { Animal } from '../../../src/domain/entities/Animal';
import {
  ConflictChoice,
  ResolveSyncConflictUseCase,
} from '../../../src/application/use-cases/ResolveSyncConflictUseCase';
import {
  CLAY_CARD_STYLE,
  CLAY_PRIMARY_BUTTON_STYLE,
  CLAY_SECONDARY_BUTTON_STYLE,
  COLORS,
  RADII,
  SPACING,
} from '../../../src/adapters/theme/tokens';

export default function ConflitoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const container = useRepositories();
  const runFullSync = useFullSync();

  const [localAnimal, setLocalAnimal] = useState<Animal | null>(null);
  const [remoteAnimal, setRemoteAnimal] = useState<Animal | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);

  const resolveUseCase = useMemo(
    () =>
      new ResolveSyncConflictUseCase(
        container.animalRepository,
        container.syncQueueRepository,
        container.remoteAnimalSource
      ),
    [container]
  );

  useEffect(() => {
    async function load() {
      if (!id) return;
      const local = await container.animalRepository.findById(id);
      setLocalAnimal(local);
      if (container.remoteAnimalSource) {
        try {
          const remote = await container.remoteAnimalSource.findById(id);
          setRemoteAnimal(remote);
        } catch {
          // ignore offline
        }
      }
      setLoading(false);
    }
    void load();
  }, [id, container]);

  const handleResolve = async (choice: ConflictChoice) => {
    if (!id) return;
    setResolving(true);
    try {
      await resolveUseCase.execute(id, choice);
      void runFullSync();
      router.replace('/(tabs)/sync');
    } catch (err: any) {
      Alert.alert('Erro', err?.message || 'Não foi possível resolver o conflito.');
    } finally {
      setResolving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EnlaceHeader showBack onBack={() => router.back()} title="Resolver conflito" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.terracotta} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <EnlaceHeader showBack onBack={() => router.back()} title="Conflito de versão" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Qual versão vamos manter?</Text>
        <Text style={styles.subtitle}>
          Este anúncio foi alterado no celular e também na nuvem antes da sincronização.
        </Text>

        <View style={styles.compareRow}>
          <View style={styles.versionCard}>
            <Text style={styles.versionBadge}>Sua edição</Text>
            <Text style={styles.versionName}>{localAnimal?.name || 'Indisponível'}</Text>
            <Text style={styles.versionMeta}>
              Status: {localAnimal?.status.isAvailable() ? 'Disponível' : 'Adotado'}
            </Text>
            <Text style={styles.versionMeta}>
              Bairro: {localAnimal?.location.neighborhood}
            </Text>
            <Text style={styles.versionDesc} numberOfLines={5}>
              {localAnimal?.characteristics.behavior}
            </Text>
          </View>

          <View style={styles.versionCard}>
            <Text style={[styles.versionBadge, styles.versionBadgeOnline]}>Versão online</Text>
            <Text style={styles.versionName}>{remoteAnimal?.name || localAnimal?.name}</Text>
            <Text style={styles.versionMeta}>
              Status: {remoteAnimal?.status.isAvailable() ? 'Disponível' : 'Adotado'}
            </Text>
            <Text style={styles.versionMeta}>
              Bairro: {remoteAnimal?.location.neighborhood || localAnimal?.location.neighborhood}
            </Text>
            <Text style={styles.versionDesc} numberOfLines={5}>
              {remoteAnimal?.characteristics.behavior || 'Versão remota no servidor'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={CLAY_PRIMARY_BUTTON_STYLE}
          onPress={() => handleResolve('KEEP_LOCAL')}
          disabled={resolving}
        >
          <Text style={styles.keepLocalText}>Manter minha edição</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={CLAY_SECONDARY_BUTTON_STYLE}
          onPress={() => handleResolve('USE_REMOTE')}
          disabled={resolving}
        >
          <Text style={styles.keepRemoteText}>Usar versão online</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.ivory,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.espresso,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.brown,
    lineHeight: 20,
  },
  compareRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  versionCard: {
    ...CLAY_CARD_STYLE,
    flex: 1,
    padding: SPACING.md,
    gap: 6,
  },
  versionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.amberBg,
    color: COLORS.terracotta,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADII.pill,
  },
  versionBadgeOnline: {
    backgroundColor: COLORS.greenBg,
    color: COLORS.green,
  },
  versionName: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.espresso,
    marginTop: 4,
  },
  versionMeta: {
    fontSize: 12,
    color: COLORS.brown,
  },
  versionDesc: {
    fontSize: 12,
    color: COLORS.espresso,
    marginTop: 4,
    lineHeight: 17,
  },
  keepLocalText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '900',
  },
  keepRemoteText: {
    color: COLORS.espresso,
    fontSize: 15,
    fontWeight: '900',
  },
});
