import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SyncAction } from '../../src/domain/entities/SyncAction';
import { useRepositories } from '../../src/adapters/context/RepositoriesContext';
import { useAuth } from '../../src/adapters/context/AuthContext';
import { useFullSync } from '../../src/adapters/hooks/useFullSync';
import { subscribePullCompleted } from '../../src/adapters/sync/pullEvents';
import { EnlaceHeader } from '../../src/adapters/components/EnlaceHeader';
import {
  CLAY_CARD_STYLE,
  CLAY_PRIMARY_BUTTON_STYLE,
  COLORS,
  RADII,
} from '../../src/adapters/theme/tokens';

/**
 * V13 • Sincronização ("Suas histórias estão salvas" — Prancha 02/02)
 */
export default function SyncScreen() {
  const router = useRouter();
  const container = useRepositories();
  const { user } = useAuth();
  const runSync = useFullSync();

  const [pendingActions, setPendingActions] = useState<SyncAction[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastResultSummary, setLastResultSummary] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    const all = await container.syncQueueRepository.listPending();
    // DAT-10: esconde pendências de outras contas
    const visible = all.filter((a) => !user || !a.ownerId || a.ownerId === user.id);
    setPendingActions(visible);
  }, [container, user]);

  useEffect(() => {
    loadQueue();
    const unsub = subscribePullCompleted(loadQueue);
    return unsub;
  }, [loadQueue]);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await runSync();
      setLastResultSummary(
        `Processados: ${res.push.processed} • Sucesso: ${res.push.succeeded} • Falhas: ${res.push.failed}`
      );
      await loadQueue();
    } finally {
      setSyncing(false);
    }
  };

  const conflictActions = pendingActions.filter(
    (a) => a.lastError && a.lastError.includes('[CONFLITO]')
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <EnlaceHeader />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={syncing}
            onRefresh={handleSyncNow}
            colors={[COLORS.terracotta]}
            tintColor={COLORS.terracotta}
          />
        }
      >
        <Text style={styles.heroTitle}>Suas histórias{'\n'}estão salvas</Text>

        <View style={styles.cloudHeroBox}>
          <View style={styles.cloudCircle}>
            <Ionicons name="sync" size={34} color={COLORS.terracotta} />
          </View>
        </View>

        <View style={styles.statusSummaryCard}>
          <View style={styles.phoneIconBox}>
            <Ionicons name="phone-portrait-outline" size={24} color={COLORS.espresso} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryTitle}>Salvo no aparelho</Text>
            <Text style={styles.summarySubtitle}>
              {pendingActions.length === 0
                ? 'Tudo sincronizado com o Supabase'
                : `${pendingActions.length} ${
                    pendingActions.length === 1
                      ? 'alteração aguardando envio'
                      : 'alterações aguardando envio'
                  }`}
            </Text>
          </View>
        </View>

        {lastResultSummary && (
          <View style={styles.feedbackPill}>
            <Ionicons name="checkmark-circle" size={16} color={COLORS.green} />
            <Text style={styles.feedbackPillText}>{lastResultSummary}</Text>
          </View>
        )}

        <TouchableOpacity
          accessibilityRole="button"
          disabled={syncing}
          onPress={handleSyncNow}
          style={[CLAY_PRIMARY_BUTTON_STYLE, { marginTop: 14 }]}
        >
          {syncing ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.primaryBtnText}>Sincronizar agora</Text>
          )}
        </TouchableOpacity>

        <View style={styles.itemsList}>
          {pendingActions.map((action) => {
            const isConflict = Boolean(
              action.lastError && action.lastError.includes('[CONFLITO]')
            );
            const titleLabel =
              action.entityType === 'animal'
                ? `Anúncio ${String(action.payload.name || '')}`.trim() || 'Anúncio de pet'
                : action.entityType === 'photo'
                ? 'Foto do anúncio'
                : action.entityType === 'favorite'
                ? 'Favorito salvo'
                : 'Manifestação de interesse';

            const stateLabel = isConflict
              ? 'Precisa de revisão'
              : action.status.isFailed()
              ? 'Falha — tentar novamente'
              : 'Pendente';

            return (
              <TouchableOpacity
                key={action.id}
                onPress={() => {
                  if (isConflict) {
                    router.push(`/(protected)/conflito/${action.entityId}`);
                  } else if (action.entityType === 'animal') {
                    router.push(`/animal/${action.entityId}`);
                  }
                }}
                style={styles.queueItemCard}
              >
                <View style={styles.queueItemIcon}>
                  <Ionicons
                    name={isConflict ? 'warning-outline' : 'cloud-upload-outline'}
                    size={20}
                    color={isConflict ? COLORS.amber : COLORS.terracotta}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.queueItemTitle}>
                    {titleLabel} • <Text style={styles.queueItemState}>{stateLabel}</Text>
                  </Text>
                  {action.lastError && (
                    <Text style={styles.queueItemError} numberOfLines={2}>
                      {action.lastError}
                    </Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.brown} />
              </TouchableOpacity>
            );
          })}
        </View>

        {conflictActions.length > 0 && (
          <View style={styles.conflictBanner}>
            <Ionicons name="warning" size={18} color={COLORS.amber} />
            <Text style={styles.conflictBannerText}>
              {conflictActions.length} alteração precisa da sua escolha
            </Text>
            <TouchableOpacity
              onPress={() =>
                router.push(`/(protected)/conflito/${conflictActions[0].entityId}`)
              }
            >
              <Text style={styles.conflictReviewLink}>Revisar</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.infoFooterRow}>
          <Ionicons name="information-circle-outline" size={16} color={COLORS.brown} />
          <Text style={styles.infoFooterText}>
            O envio continua automaticamente quando a conexão voltar.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.ivory,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.espresso,
    lineHeight: 31,
  },
  cloudHeroBox: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  cloudCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.cream,
    borderWidth: 2,
    borderColor: COLORS.peach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusSummaryCard: {
    ...CLAY_CARD_STYLE,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  phoneIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.ivory,
    borderWidth: 1,
    borderColor: COLORS.peach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.espresso,
  },
  summarySubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.brown,
    marginTop: 2,
  },
  feedbackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.greenBg,
    borderRadius: RADII.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
  },
  feedbackPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.green,
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '900',
  },
  itemsList: {
    marginTop: 14,
    gap: 10,
  },
  queueItemCard: {
    ...CLAY_CARD_STYLE,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  queueItemIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.ivory,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueItemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.espresso,
  },
  queueItemState: {
    color: COLORS.brown,
    fontWeight: '700',
  },
  queueItemError: {
    fontSize: 11,
    color: COLORS.danger,
    marginTop: 2,
  },
  conflictBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.amberBg,
    borderRadius: RADII.md,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#F3C88B',
  },
  conflictBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.espresso,
  },
  conflictReviewLink: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.terracotta,
    textDecorationLine: 'underline',
  },
  infoFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },
  infoFooterText: {
    fontSize: 12,
    color: COLORS.brown,
    fontWeight: '600',
  },
});
