import React, { useCallback, useEffect, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRepositories } from '../../src/adapters/context/RepositoriesContext';
import { useAuth } from '../../src/adapters/context/AuthContext';
import { useConnectivity } from '../../src/adapters/hooks/useConnectivity';
import { useFullSync } from '../../src/adapters/hooks/useFullSync';
import { useUseCases } from '../../src/adapters/hooks/useUseCases';
import { notifyPullCompleted } from '../../src/adapters/sync/pullEvents';
import { recordInterestWithdrawal } from '../../src/adapters/sync/interestWithdrawalEvents';
import { notifyNotificationsChanged } from '../../src/adapters/sync/notificationEvents';
import { EnlaceHeader } from '../../src/adapters/components/EnlaceHeader';
import { PhotoCarouselViewer } from '../../src/adapters/components/PhotoCarouselViewer';
import {
  INTEREST_STAGE_LABELS,
  OwnerInterestsCard,
} from '../../src/adapters/components/OwnerInterestsCard';
import { AdoptionInterestModal } from '../../src/adapters/components/AdoptionInterestModal';
import { exportAnimalPdf } from '../../src/adapters/pdf/exportAnimalPdf';
import { Animal } from '../../src/domain/entities/Animal';
import {
  AdoptionInterest,
  INTEREST_PIPELINE_STEPS,
  InterestStage,
} from '../../src/domain/entities/AdoptionInterest';
import {
  CLAY_CARD_STYLE,
  CLAY_PRIMARY_BUTTON_STYLE,
  CLAY_SECONDARY_BUTTON_STYLE,
  COLORS,
  RADII,
  SPACING,
} from '../../src/adapters/theme/tokens';

export default function AnimalDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const container = useRepositories();
  const { user } = useAuth();
  const isOnline = useConnectivity();
  const runFullSync = useFullSync();
  const {
    getAnimalDetailsUseCase,
    toggleFavoriteUseCase,
    registerAdoptionInterestUseCase,
    updateInterestStatusUseCase,
    markAnimalAdoptedUseCase,
    deleteAnimalUseCase,
  } = useUseCases();

  const [animal, setAnimal] = useState<Animal | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [interests, setInterests] = useState<AdoptionInterest[]>([]);
  const [myInterest, setMyInterest] = useState<AdoptionInterest | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [contactPhone, setContactPhone] = useState(user?.contactInfo || '');
  const [submitting, setSubmitting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const loadDetails = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const found = await getAnimalDetailsUseCase.execute(id, isOnline);
      setAnimal(found);

      if (found) {
        setIsFavorite(
          user ? await container.favoriteRepository.isFavorite(user.id, found.id) : false
        );

        let merged = await container.interestRepository.listByAnimal(found.id);
        if (isOnline && container.remoteInterests) {
          try {
            const remoteList = await container.remoteInterests.listByAnimal(found.id);
            const map = new Map<string, AdoptionInterest>();
            let withdrawalDetected = false;
            for (const item of merged) map.set(item.id, item);

            if (user?.id === found.ownerId) {
              const remoteIds = new Set(remoteList.map((item) => item.id));
              const pending = await container.syncQueueRepository.listPending();
              const pendingInterestIds = new Set(
                pending
                  .filter((action) => action.entityType === 'interest')
                  .map((action) => action.entityId)
              );

              for (const localInterest of merged) {
                if (
                  remoteIds.has(localInterest.id) ||
                  pendingInterestIds.has(localInterest.id)
                ) {
                  continue;
                }
                await container.interestRepository.remove(localInterest.id);
                await recordInterestWithdrawal(
                  container.appStateRepository,
                  user.id,
                  found.name,
                  localInterest
                );
                map.delete(localInterest.id);
                withdrawalDetected = true;
              }
            }

            for (const remoteItem of remoteList) {
              map.set(remoteItem.id, remoteItem);
              await container.interestRepository.save(remoteItem);
            }
            merged = Array.from(map.values());
            if (withdrawalDetected) notifyNotificationsChanged();
          } catch {
            // fallback local
          }
        }
        setInterests(merged);
        setMyInterest(user ? merged.find((i) => i.userId === user.id) ?? null : null);
      }
    } finally {
      setLoading(false);
    }
  }, [id, getAnimalDetailsUseCase, isOnline, user, container]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  useEffect(() => {
    if (user?.contactInfo && !contactPhone) {
      setContactPhone(user.contactInfo);
    }
  }, [user?.contactInfo, contactPhone]);

  const handleToggleFavorite = async () => {
    if (!user || !animal) {
      router.push('/(public)/login');
      return;
    }
    const res = await toggleFavoriteUseCase.execute(user.id, animal.id, isOnline);
    setIsFavorite(res.favorited);
    notifyPullCompleted();
  };

  const handleSendInterest = async () => {
    if (!user || !animal) {
      router.push('/(public)/login');
      return;
    }
    if (!message.trim() || message.trim().length < 10) {
      Alert.alert(
        'Mensagem muito curta',
        'Conte um pouco sobre você e seu lar (mínimo de 10 caracteres).'
      );
      return;
    }
    setSubmitting(true);
    try {
      const res = await registerAdoptionInterestUseCase.execute({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        animalId: animal.id,
        message: message.trim(),
        contactInfo: contactPhone.trim() || user.contactInfo || user.email,
        isOnline,
      });
      setMyInterest(res.interest);
      setModalVisible(false);
      await loadDetails();
      Alert.alert('Interesse enviado!', 'O responsável pelo animal recebeu sua manifestação.');
    } catch (err: any) {
      Alert.alert('Aviso', err?.message || 'Não foi possível registrar o interesse.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdvanceInterest = (interest: AdoptionInterest, nextStage: InterestStage) => {
    if (!user || !animal) return;
    const nomeInteressado = interest.userName || 'Interessado';
    const statusLabel = INTEREST_STAGE_LABELS[nextStage];
    Alert.alert(
      'Confirmar atualização',
      `Você tem certeza que quer atualizar o status de interesse de ${nomeInteressado} em ${animal.name} para "${statusLabel}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            try {
              await updateInterestStatusUseCase.execute(
                interest.id,
                user.id,
                nextStage,
                isOnline
              );
              await loadDetails();
              notifyPullCompleted();
              void runFullSync();
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível atualizar a etapa.');
            }
          },
        },
      ]
    );
  };

  const handleMarkAdopted = () => {
    if (!user || !animal) return;
    Alert.alert('Confirmar adoção', `Marcar ${animal.name} como adotado?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sim, marcar como adotado',
        onPress: async () => {
          try {
            await markAnimalAdoptedUseCase.execute(animal.id, user.id, isOnline);
            await loadDetails();
            notifyPullCompleted();
            void runFullSync();
          } catch (err: any) {
            Alert.alert('Erro', err?.message || 'Não foi possível marcar como adotado.');
          }
        },
      },
    ]);
  };

  const handleReopenAdoption = () => {
    if (!user || !animal) return;
    Alert.alert(
      'Reabrir para adoção',
      `Deseja reabrir o anúncio de ${animal.name} como "Disponível"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sim, reabrir',
          onPress: async () => {
            try {
              await markAnimalAdoptedUseCase.reopen(animal.id, user.id, isOnline);
              await loadDetails();
              notifyPullCompleted();
              void runFullSync();
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível reabrir o anúncio.');
            }
          },
        },
      ]
    );
  };

  const handleCancelMyInterest = () => {
    if (!user || !myInterest || !animal) return;
    Alert.alert(
      'Cancelar interesse',
      `Deseja retirar sua manifestação de interesse em ${animal.name}?`,
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Retirar interesse',
          style: 'destructive',
          onPress: async () => {
            try {
              await registerAdoptionInterestUseCase.cancel(myInterest.id, user.id, isOnline);
              setMyInterest(null);
              await loadDetails();
              void runFullSync();
            } catch (err: any) {
              Alert.alert('Erro', err?.message || 'Não foi possível cancelar o interesse.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAnimal = () => {
    if (!user || !animal) return;
    Alert.alert('Remover anúncio', `Deseja remover o anúncio de ${animal.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAnimalUseCase.execute(animal.id, user.id, isOnline);
            notifyPullCompleted();
            void runFullSync();
            router.back();
          } catch (err: any) {
            Alert.alert('Erro', err?.message || 'Não foi possível remover.');
          }
        },
      },
    ]);
  };

  const handleExportPdf = async () => {
    if (!animal) return;
    setExportingPdf(true);
    try {
      await exportAnimalPdf(animal);
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EnlaceHeader showBack onBack={() => router.back()} title="Detalhes" />
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COLORS.terracotta} />
        </View>
      </SafeAreaView>
    );
  }

  if (!animal) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EnlaceHeader showBack onBack={() => router.back()} title="Detalhes" />
        <View style={styles.centerBox}>
          <Text style={styles.emptyTitle}>Anúncio não encontrado</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isOwner = Boolean(user && user.id === animal.ownerId);

  return (
    <SafeAreaView style={styles.safeArea}>
      <EnlaceHeader
        showBack
        onBack={() => router.back()}
        title={isOwner ? 'Detalhes: Responsável' : 'Detalhes: Adoção'}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <PhotoCarouselViewer photos={animal.photos} />

        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.animalName}>{animal.name}</Text>
            <Text style={styles.locationSubtitle}>{animal.location.displayLabel}</Text>
          </View>

          <TouchableOpacity onPress={handleToggleFavorite} style={styles.favButton}>
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={22}
              color={isFavorite ? COLORS.terracotta : COLORS.espresso}
            />
          </TouchableOpacity>

          <View
            style={[
              styles.statusPill,
              !animal.status.isAvailable() ? styles.statusAdopted : styles.statusAvailable,
            ]}
          >
            <Text style={styles.statusPillText}>
              {animal.status.isAvailable() ? 'Disponível' : 'Adotado'}
            </Text>
          </View>
        </View>

        {/* 4 Attribute Clay Cards (V06) */}
        <View style={styles.attributesGrid}>
          <View style={styles.attrCard}>
            <Text style={styles.attrLabel}>Espécie</Text>
            <Text style={styles.attrValue}>{animal.characteristics.species}</Text>
          </View>
          <View style={styles.attrCard}>
            <Text style={styles.attrLabel}>Porte</Text>
            <Text style={styles.attrValue}>{animal.characteristics.size}</Text>
          </View>
          <View style={styles.attrCard}>
            <Text style={styles.attrLabel}>Idade</Text>
            <Text style={styles.attrValue}>{animal.characteristics.approximateAge}</Text>
          </View>
          <View style={styles.attrCard}>
            <Text style={styles.attrLabel}>Sexo</Text>
            <Text style={styles.attrValue}>{animal.characteristics.sex}</Text>
          </View>
        </View>

        {/* Comportamento e Cuidados */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Comportamento e história</Text>
          <Text style={styles.sectionBody}>
            {animal.characteristics.behavior ||
              animal.characteristics.characteristics ||
              'Pet dócil e pronto para adoção responsável.'}
          </Text>

          {animal.characteristics.specialCare ? (
            <View style={styles.optionalNote}>
              <Ionicons name="medkit-outline" size={16} color={COLORS.green} />
              <Text style={styles.optionalNoteText}>
                Cuidados especiais: {animal.characteristics.specialCare}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Privacidade de Localização (RNF05) */}
        <View style={styles.privacyBanner}>
          <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.green} />
          <Text style={styles.privacyText}>
            Localização aproximada ({animal.location.displayLabel}) para proteger a privacidade do
            responsável.
          </Text>
        </View>

        {/* Visão do Visitante / Interessado (V06) */}
        {!isOwner && (
          <View style={styles.actionSection}>
            {myInterest ? (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Acompanhamento do seu interesse</Text>
                <Text style={styles.pipelineSub}>
                  Etapa atual: {INTEREST_STAGE_LABELS[myInterest.status]}
                </Text>
                <View style={styles.stagesRow}>
                  {INTEREST_PIPELINE_STEPS.map((stage, idx) => {
                    const currentIndex = INTEREST_PIPELINE_STEPS.indexOf(myInterest.status);
                    const active = idx <= currentIndex && myInterest.status !== 'RECUSADA';
                    return (
                      <View
                        key={stage}
                        style={[styles.stageChip, active && styles.stageChipActive]}
                      >
                        <Text
                          style={[styles.stageChipText, active && styles.stageChipTextActive]}
                        >
                          {idx + 1}. {INTEREST_STAGE_LABELS[stage]}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                <Text style={styles.sectionBody}>
                  {myInterest.status === 'ENVIADA'
                    ? 'O responsável recebeu seu contato e entrará em contato assim que iniciar a análise.'
                    : myInterest.status === 'RECUSADA'
                    ? 'Esta manifestação foi encerrada pelo responsável.'
                    : 'Seu contato direto com o responsável está ativo para alinhamento da visita/adoção.'}
                </Text>
                <TouchableOpacity
                  style={[CLAY_SECONDARY_BUTTON_STYLE, { marginTop: 4 }]}
                  onPress={handleCancelMyInterest}
                >
                  <Ionicons name="close-circle-outline" size={18} color={COLORS.danger} />
                  <Text style={[styles.secondaryButtonText, { color: COLORS.danger }]}>
                    {' '}
                    Cancelar meu interesse
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              animal.status.isAvailable() && (
                <TouchableOpacity
                  style={CLAY_PRIMARY_BUTTON_STYLE}
                  onPress={() => {
                    if (!user) {
                      router.push('/(public)/login');
                      return;
                    }
                    setModalVisible(true);
                  }}
                >
                  <Ionicons
                    name="paw"
                    size={18}
                    color={COLORS.white}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.primaryButtonText}>Demonstrar interesse</Text>
                </TouchableOpacity>
              )
            )}
          </View>
        )}

        {/* Visão do Responsável (V16: Detalhes: Responsável) */}
        {isOwner && (
          <View style={styles.ownerSection}>
            <View style={styles.ownerActionsRow}>
              <TouchableOpacity
                style={[CLAY_SECONDARY_BUTTON_STYLE, { flex: 1 }]}
                onPress={() => router.push(`/(protected)/editar-anuncio/${animal.id}`)}
              >
                <Ionicons name="create-outline" size={18} color={COLORS.espresso} />
                <Text style={styles.secondaryButtonText}> Editar</Text>
              </TouchableOpacity>

              {animal.status.isAvailable() ? (
                <TouchableOpacity style={styles.sageButton} onPress={handleMarkAdopted}>
                  <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.white} />
                  <Text style={styles.sageButtonText}>Marcar como adotado</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.sageButton} onPress={handleReopenAdoption}>
                  <Ionicons name="refresh-outline" size={18} color={COLORS.white} />
                  <Text style={styles.sageButtonText}>Reabrir para adoção</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.dangerIconButton} onPress={handleDeleteAnimal}>
                <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
              </TouchableOpacity>
            </View>

            <OwnerInterestsCard interests={interests} onSelectStage={handleAdvanceInterest} />
          </View>
        )}

        {/* Exportar PDF (V06 e V16) */}
        <TouchableOpacity
          style={CLAY_SECONDARY_BUTTON_STYLE}
          onPress={handleExportPdf}
          disabled={exportingPdf}
        >
          <Ionicons
            name="document-text-outline"
            size={18}
            color={COLORS.espresso}
            style={{ marginRight: 8 }}
          />
          <Text style={styles.secondaryButtonText}>
            {exportingPdf ? 'Gerando ficha PDF...' : 'Gerar PDF do anúncio'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <AdoptionInterestModal
        visible={modalVisible}
        animalName={animal.name}
        contactPhone={contactPhone}
        onChangeContactPhone={setContactPhone}
        message={message}
        onChangeMessage={setMessage}
        submitting={submitting}
        onClose={() => setModalVisible(false)}
        onSubmit={handleSendInterest}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.ivory,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.espresso,
  },
  favButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.cream,
    borderWidth: 1.5,
    borderColor: COLORS.peach,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl * 2,
    gap: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
  },
  animalName: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.espresso,
  },
  locationSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.brown,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADII.pill,
  },
  statusAvailable: {
    backgroundColor: COLORS.greenBg,
  },
  statusAdopted: {
    backgroundColor: COLORS.amberBg,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.espresso,
  },
  attributesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  attrCard: {
    ...CLAY_CARD_STYLE,
    flex: 1,
    minWidth: '45%',
    padding: SPACING.md,
  },
  attrLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.brownMuted,
    textTransform: 'uppercase',
  },
  attrValue: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.espresso,
    marginTop: 4,
  },
  sectionCard: {
    ...CLAY_CARD_STYLE,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.espresso,
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.brown,
  },
  optionalNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.ivory,
    padding: SPACING.sm,
    borderRadius: RADII.sm,
  },
  optionalNoteText: {
    fontSize: 13,
    color: COLORS.espresso,
    flex: 1,
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.greenBg,
    padding: SPACING.md,
    borderRadius: RADII.md,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.espresso,
    lineHeight: 17,
    fontWeight: '600',
  },
  actionSection: {
    marginTop: SPACING.xs,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButtonText: {
    color: COLORS.espresso,
    fontSize: 14,
    fontWeight: '800',
  },
  pipelineSub: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.terracotta,
  },
  stagesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  stageChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.ivory,
  },
  stageChipActive: {
    backgroundColor: COLORS.green,
  },
  stageChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.brown,
  },
  stageChipTextActive: {
    color: COLORS.white,
  },
  ownerSection: {
    gap: SPACING.md,
  },
  ownerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sageButton: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.green,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: RADII.pill,
  },
  sageButtonText: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.white,
  },
  dangerIconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.cream,
    borderWidth: 1.5,
    borderColor: COLORS.peach,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
