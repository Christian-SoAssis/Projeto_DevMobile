import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EnlaceHeader } from './EnlaceHeader';
import {
  CLAY_PRIMARY_BUTTON_STYLE,
  CLAY_SECONDARY_BUTTON_STYLE,
  COLORS,
} from '../theme/tokens';

export interface VisitorAccountViewProps {
  onLoginPress: () => void;
  onRegisterPress: () => void;
}

/**
 * V08 • Conta: Visitante (Prancha 01/02)
 */
export function VisitorAccountView({
  onLoginPress,
  onRegisterPress,
}: VisitorAccountViewProps) {
  return (
    <ScrollView contentContainerStyle={styles.visitorContainer}>
      <EnlaceHeader largeLogo />

      <View style={styles.visitorArtCircle}>
        <Ionicons name="paw" size={54} color={COLORS.terracotta} />
        <Ionicons name="heart" size={28} color={COLORS.orange} />
      </View>

      <Text style={styles.visitorTitle}>Você está como{'\n'}visitante</Text>
      <Text style={styles.visitorSubtitle}>
        Entre para favoritar, demonstrar interesse e anunciar.
      </Text>

      <View style={styles.featureTriadRow}>
        <View style={styles.featurePillar}>
          <View style={styles.featureCircle}>
            <Ionicons name="heart-outline" size={22} color={COLORS.terracotta} />
          </View>
          <Text style={styles.featureLabel}>Favoritar{'\n'}animais</Text>
        </View>
        <View style={styles.featurePillar}>
          <View style={styles.featureCircle}>
            <Ionicons name="paw-outline" size={22} color={COLORS.terracotta} />
          </View>
          <Text style={styles.featureLabel}>Demonstrar{'\n'}interesse</Text>
        </View>
        <View style={styles.featurePillar}>
          <View style={styles.featureCircle}>
            <Ionicons name="home-outline" size={22} color={COLORS.terracotta} />
          </View>
          <Text style={styles.featureLabel}>Anunciar{'\n'}resgates</Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={onLoginPress}
        style={[CLAY_PRIMARY_BUTTON_STYLE, { width: '100%', marginTop: 22 }]}
      >
        <Text style={styles.primaryBtnText}>Entrar</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onRegisterPress}
        style={[CLAY_SECONDARY_BUTTON_STYLE, { width: '100%', marginTop: 12 }]}
      >
        <Text style={styles.secondaryBtnText}>Criar conta</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  visitorContainer: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: 'center',
  },
  visitorArtCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: COLORS.cream,
    borderWidth: 2,
    borderColor: COLORS.peach,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    marginVertical: 14,
  },
  visitorTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.espresso,
    textAlign: 'center',
    lineHeight: 31,
  },
  visitorSubtitle: {
    fontSize: 14,
    color: COLORS.brown,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 18,
  },
  featureTriadRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    gap: 10,
  },
  featurePillar: {
    alignItems: 'center',
    flex: 1,
  },
  featureCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.cream,
    borderWidth: 1.5,
    borderColor: COLORS.peach,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  featureLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.espresso,
    textAlign: 'center',
  },
  primaryBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryBtnText: {
    color: COLORS.espresso,
    fontSize: 15,
    fontWeight: '800',
  },
});
