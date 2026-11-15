import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRepositories } from '../../src/adapters/context/RepositoriesContext';
import { useAuth } from '../../src/adapters/context/AuthContext';
import { EnlaceHeader } from '../../src/adapters/components/EnlaceHeader';
import { Animal } from '../../src/domain/entities/Animal';
import { ModerateAnimalUseCase } from '../../src/application/use-cases/ModerateAnimalUseCase';
import { CLAY_CARD_STYLE, COLORS, RADII, SPACING } from '../../src/adapters/theme/tokens';

export default function ModeracaoScreen() {
  const router = useRouter();
  const container = useRepositories();
  const { user } = useAuth();

  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);

  const moderateUseCase = useMemo(
    () => new ModerateAnimalUseCase(container.animalRepository, container.moderationGateway),
    [container]
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      if (container.moderationGateway) {
        const remoteList = await container.moderationGateway.listAllForModeration();
        if (remoteList.length > 0) {
          setAnimals(remoteList);
          return;
        }
      }
      const localList = await container.animalRepository.search({ includeHidden: true });
      setAnimals(localList);
    } finally {
      setLoading(false);
    }
  }, [container]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleToggleModeration = async (animal: Animal) => {
    if (!user) return;
    const action = animal.hidden ? 'UNHIDE' : 'HIDE';
    try {
      await moderateUseCase.execute(user, animal.id, action);
      await loadAll();
    } catch (err: any) {
      Alert.alert('Erro na moderação', err?.message || 'Operação não permitida.');
    }
  };

  if (user?.role !== 'ADMIN') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EnlaceHeader showBack onBack={() => router.back()} title="Moderação" />
        <View style={styles.center}>
          <Text style={styles.restrictedText}>Acesso restrito a administradores.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <EnlaceHeader showBack onBack={() => router.back()} title="Moderação de anúncios" />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.terracotta} />
        </View>
      ) : (
        <FlatList
          data={animals}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const isHidden = item.hidden;
            return (
              <View style={styles.itemCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>
                    {item.location.displayLabel} • {isHidden ? 'Oculto' : 'Visível'}
                  </Text>
                </View>

                <Pressable
                  style={[styles.modBtn, isHidden ? styles.modBtnRestore : styles.modBtnHide]}
                  onPress={() => handleToggleModeration(item)}
                >
                  <Ionicons
                    name={isHidden ? 'eye-outline' : 'eye-off-outline'}
                    size={16}
                    color={COLORS.white}
                  />
                  <Text style={styles.modBtnText}>{isHidden ? 'Reexibir' : 'Ocultar'}</Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}
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
    padding: SPACING.lg,
  },
  restrictedText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.danger,
  },
  listContent: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  itemCard: {
    ...CLAY_CARD_STYLE,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.espresso,
  },
  itemMeta: {
    fontSize: 12,
    color: COLORS.brown,
    marginTop: 2,
  },
  modBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADII.pill,
  },
  modBtnHide: {
    backgroundColor: COLORS.terracotta,
  },
  modBtnRestore: {
    backgroundColor: COLORS.green,
  },
  modBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '800',
  },
});
