import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADII } from '../theme/tokens';

export interface EnlaceHeaderProps {
  cityLabel?: string;
  showBack?: boolean;
  onBack?: () => void;
  title?: string;
  largeLogo?: boolean;
}

/**
 * Cabeçalho compartilhado e Emblema da Marca Enlace (UI-02, UI-05).
 */
export function EnlaceHeader({
  cityLabel = 'Varginha, MG',
  showBack = false,
  onBack,
  title,
  largeLogo = false,
}: EnlaceHeaderProps) {
  if (largeLogo) {
    return (
      <View style={styles.heroBrandContainer}>
        <View style={styles.heroLogoCircle}>
          <Ionicons name="paw" size={28} color={COLORS.ivory} />
          <View style={styles.heroHeartBadge}>
            <Ionicons name="heart" size={14} color={COLORS.white} />
          </View>
        </View>
        <Text style={styles.heroBrandTitle}>Enlace</Text>
      </View>
    );
  }

  return (
    <View style={styles.headerRow}>
      {showBack ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={onBack}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.espresso} />
        </TouchableOpacity>
      ) : (
        <View style={styles.brandInline}>
          <View style={styles.smallLogoBadge}>
            <Ionicons name="paw" size={16} color={COLORS.ivory} />
          </View>
          <Text style={styles.brandText}>Enlace</Text>
        </View>
      )}

      {title ? (
        <Text style={styles.screenTitle}>{title}</Text>
      ) : (
        <View style={styles.locationPill}>
          <Ionicons name="location-sharp" size={14} color={COLORS.terracotta} />
          <Text style={styles.locationText}>{cityLabel}</Text>
          <Ionicons name="chevron-down" size={13} color={COLORS.brown} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  brandInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smallLogoBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.terracotta,
    borderWidth: 2,
    borderColor: COLORS.espresso,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.espresso,
    letterSpacing: -0.4,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.cream,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: COLORS.peach,
  },
  locationText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.espresso,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.cream,
    borderWidth: 1.5,
    borderColor: COLORS.peach,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.espresso,
    flex: 1,
    textAlign: 'center',
    marginRight: 42,
  },
  heroBrandContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  heroLogoCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.terracotta,
    borderWidth: 3,
    borderColor: COLORS.espresso,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  heroHeartBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.orange,
    borderWidth: 2,
    borderColor: COLORS.espresso,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBrandTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: COLORS.espresso,
    letterSpacing: -0.6,
  },
});
