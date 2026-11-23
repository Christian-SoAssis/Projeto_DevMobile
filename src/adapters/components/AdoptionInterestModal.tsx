import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CLAY_INSET_INPUT_STYLE,
  CLAY_PRIMARY_BUTTON_STYLE,
  CLAY_SECONDARY_BUTTON_STYLE,
  COLORS,
  RADII,
  SPACING,
} from '../theme/tokens';

export interface AdoptionInterestModalProps {
  visible: boolean;
  animalName: string;
  contactPhone: string;
  onChangeContactPhone: (value: string) => void;
  message: string;
  onChangeMessage: (value: string) => void;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

/**
 * Modal de manifestação de interesse em adoção (V06, Decisão D2).
 */
export function AdoptionInterestModal({
  visible,
  animalName,
  contactPhone,
  onChangeContactPhone,
  message,
  onChangeMessage,
  submitting,
  onClose,
  onSubmit,
}: AdoptionInterestModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Demonstrar interesse em {animalName}</Text>
          <Text style={styles.modalSubtitle}>
            Envie uma mensagem para o responsável combinando a conversa inicial.
          </Text>

          <Text style={styles.inputLabel}>Telefone / WhatsApp</Text>
          <TextInput
            style={CLAY_INSET_INPUT_STYLE}
            value={contactPhone}
            onChangeText={onChangeContactPhone}
            placeholder="(35) 99999-0000"
            placeholderTextColor={COLORS.brownMuted}
            keyboardType="phone-pad"
          />

          <Text style={styles.inputLabel}>Sua mensagem (10 a 400 caracteres)</Text>
          <TextInput
            style={[CLAY_INSET_INPUT_STYLE, styles.textArea]}
            value={message}
            onChangeText={onChangeMessage}
            placeholder="Conte sobre sua rotina, experiência com pets e espaço disponível..."
            placeholderTextColor={COLORS.brownMuted}
            maxLength={400}
            multiline
          />

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[CLAY_SECONDARY_BUTTON_STYLE, { flex: 1 }]}
              onPress={onClose}
            >
              <Text style={styles.secondaryButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[CLAY_PRIMARY_BUTTON_STYLE, { flex: 1 }]}
              onPress={onSubmit}
              disabled={submitting}
            >
              <Text style={styles.primaryButtonText}>
                {submitting ? 'Enviando...' : 'Enviar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(58, 31, 20, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.ivory,
    borderTopLeftRadius: RADII.xl,
    borderTopRightRadius: RADII.xl,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.espresso,
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.brown,
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.espresso,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
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
});
