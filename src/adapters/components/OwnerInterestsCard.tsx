import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  AdoptionInterest,
  INTEREST_PIPELINE_STEPS,
  InterestStage,
} from '../../domain/entities/AdoptionInterest';
import { CLAY_CARD_STYLE, COLORS, RADII, SPACING } from '../theme/tokens';

export const INTEREST_STAGE_LABELS: Record<InterestStage, string> = {
  ENVIADA: 'Enviada',
  EM_ANALISE: 'Em análise',
  VISITA_COMBINADA: 'Visita combinada',
  CONCLUIDA: 'Concluída',
  RECUSADA: 'Recusada',
};

export interface OwnerInterestsCardProps {
  interests: AdoptionInterest[];
  onSelectStage: (interest: AdoptionInterest, nextStage: InterestStage) => void;
}

/**
 * Seção "Interessados • N" exibida na visão do responsável pelo anúncio (V16, Decisão 19).
 */
export function OwnerInterestsCard({ interests, onSelectStage }: OwnerInterestsCardProps) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>Interessados • {interests.length}</Text>
      {interests.length === 0 ? (
        <Text style={styles.sectionBody}>
          Ainda não há manifestações de interesse para este anúncio.
        </Text>
      ) : (
        interests.map((item) => (
          <View key={item.id} style={styles.interestItemCard}>
            <View style={styles.interestItemHeader}>
              <Text style={styles.interestContactName}>{item.userName || 'Interessado'}</Text>
              <View style={styles.interestStageBadge}>
                <Text style={styles.interestStageBadgeText}>
                  {INTEREST_STAGE_LABELS[item.status]}
                </Text>
              </View>
            </View>
            <Text style={styles.interestPhone}>Contato: {item.contactInfo}</Text>
            <Text style={styles.interestMessage}>"{item.message}"</Text>

            <View style={styles.stageButtonsRow}>
              {([...INTEREST_PIPELINE_STEPS, 'RECUSADA'] as InterestStage[]).map((stage) => {
                const isCurrent = item.status === stage;
                const currentStepIndex = INTEREST_PIPELINE_STEPS.indexOf(item.status);
                // Só permite avançar na trilha (não voltar estágios). RECUSADA segue a regra de negócio.
                const canSelectStage =
                  stage === 'RECUSADA'
                    ? item.status === 'ENVIADA' || item.status === 'EM_ANALISE'
                    : INTEREST_PIPELINE_STEPS.indexOf(stage) >= currentStepIndex;
                return (
                  <Pressable
                    key={stage}
                    style={[
                      styles.stageSmallBtn,
                      isCurrent && styles.stageSmallBtnActive,
                      !canSelectStage && styles.stageSmallBtnDisabled,
                    ]}
                    disabled={!canSelectStage}
                    onPress={!canSelectStage ? undefined : () => onSelectStage(item, stage)}
                  >
                    <Text
                      style={[
                        styles.stageSmallBtnText,
                        isCurrent && styles.stageSmallBtnTextActive,
                      ]}
                    >
                      {INTEREST_STAGE_LABELS[stage]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  interestItemCard: {
    backgroundColor: COLORS.ivory,
    padding: SPACING.md,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.peach,
    gap: 6,
  },
  interestItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  interestContactName: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.espresso,
  },
  interestStageBadge: {
    backgroundColor: COLORS.amberBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADII.pill,
  },
  interestStageBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.terracotta,
  },
  interestPhone: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.brown,
  },
  interestMessage: {
    fontSize: 13,
    color: COLORS.espresso,
    fontStyle: 'italic',
  },
  stageButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  stageSmallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: COLORS.peach,
  },
  stageSmallBtnActive: {
    backgroundColor: COLORS.terracotta,
    borderColor: COLORS.terracotta,
  },
  stageSmallBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.espresso,
  },
  stageSmallBtnTextActive: {
    color: COLORS.white,
  },
  stageSmallBtnDisabled: {
    opacity: 0.5,
  },
});
