import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SpeciesFilterOption } from '../hooks/useSearchFilters';
import {
  CLAY_INSET_INPUT_STYLE,
  CLAY_PRIMARY_BUTTON_STYLE,
  CLAY_SECONDARY_BUTTON_STYLE,
  COLORS,
  RADII,
} from '../theme/tokens';

export interface SearchFilterModalProps {
  visible: boolean;
  species: SpeciesFilterOption;
  onChangeSpecies: (val: SpeciesFilterOption) => void;
  size: string;
  onChangeSize: (val: string) => void;
  sex: string;
  onChangeSex: (val: string) => void;
  approximateAge: string;
  onChangeApproximateAge: (val: string) => void;
  distanceKm: number | undefined;
  onChangeDistanceKm: (val: number | undefined) => void;
  onClose: () => void;
  onClear: () => void;
  onApply: () => void;
}

export function SearchFilterModal({
  visible,
  species,
  onChangeSpecies,
  size,
  onChangeSize,
  sex,
  onChangeSex,
  approximateAge,
  onChangeApproximateAge,
  distanceKm,
  onChangeDistanceKm,
  onClose,
  onClear,
  onApply,
}: SearchFilterModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.filterSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>Encontre seu{'\n'}companheiro</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Fechar filtros"
              onPress={onClose}
            >
              <Ionicons name="close" size={24} color={COLORS.espresso} />
            </TouchableOpacity>
          </View>

          <Text style={styles.filterGroupLabel}>Espécie</Text>
          <View style={styles.filterOptionRow}>
            {(
              [
                { label: 'Todos', val: 'Todos' },
                { label: 'Cães', val: 'Cão' },
                { label: 'Gatos', val: 'Gato' },
              ] as const
            ).map((opt) => (
              <TouchableOpacity
                key={opt.val}
                onPress={() => onChangeSpecies(opt.val)}
                style={[
                  styles.filterOptionPill,
                  species === opt.val && styles.filterOptionPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    species === opt.val && styles.filterOptionTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.filterGroupLabel}>Porte</Text>
          <View style={styles.filterOptionRow}>
            {(['Todos', 'Pequeno', 'Médio', 'Grande'] as const).map((sz) => (
              <TouchableOpacity
                key={sz}
                onPress={() => onChangeSize(sz)}
                style={[
                  styles.filterOptionPill,
                  size === sz && styles.filterOptionPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    size === sz && styles.filterOptionTextActive,
                  ]}
                >
                  {sz}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.filterGroupLabel}>Sexo</Text>
          <View style={styles.filterOptionRow}>
            {(['Todos', 'Macho', 'Fêmea'] as const).map((sx) => (
              <TouchableOpacity
                key={sx}
                onPress={() => onChangeSex(sx)}
                style={[
                  styles.filterOptionPill,
                  sex === sx && styles.filterOptionPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    sex === sx && styles.filterOptionTextActive,
                  ]}
                >
                  {sx}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.filterGroupLabel}>Idade aproximada</Text>
          <View style={styles.ageInputRow}>
            <Ionicons name="calendar-outline" size={18} color={COLORS.brown} />
            <TextInput
              style={styles.searchInput}
              placeholder="Ex.: 2 anos"
              placeholderTextColor={COLORS.brownMuted}
              value={approximateAge}
              onChangeText={onChangeApproximateAge}
            />
          </View>

          <Text style={styles.filterGroupLabel}>Distância máxima (RF04 — máx. 10 km)</Text>
          <View style={styles.filterOptionRow}>
            {[
              { label: 'Qualquer', km: undefined },
              { label: 'Até 5 km', km: 5 },
              { label: 'Até 10 km', km: 10 },
            ].map((d) => (
              <TouchableOpacity
                key={d.label}
                onPress={() => onChangeDistanceKm(d.km)}
                style={[
                  styles.filterOptionPill,
                  distanceKm === d.km && styles.filterOptionPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    distanceKm === d.km && styles.filterOptionTextActive,
                  ]}
                >
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.sheetActionsRow}>
            <TouchableOpacity
              onPress={onClear}
              style={[CLAY_SECONDARY_BUTTON_STYLE, { flex: 1 }]}
            >
              <Text style={styles.clearBtnText}>Limpar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onApply}
              style={[CLAY_PRIMARY_BUTTON_STYLE, { flex: 1.4 }]}
            >
              <Text style={styles.applyBtnText}>Aplicar filtros</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(58, 31, 20, 0.48)',
    justifyContent: 'flex-end',
  },
  filterSheet: {
    backgroundColor: COLORS.ivory,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 2,
    borderColor: COLORS.peach,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.peach,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.espresso,
  },
  filterGroupLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.espresso,
    marginTop: 10,
    marginBottom: 6,
  },
  filterOptionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOptionPill: {
    backgroundColor: COLORS.cream,
    borderRadius: RADII.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: COLORS.peach,
  },
  filterOptionPillActive: {
    backgroundColor: COLORS.terracotta,
    borderColor: COLORS.terracottaDark,
  },
  filterOptionText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.espresso,
  },
  filterOptionTextActive: {
    color: COLORS.white,
  },
  ageInputRow: {
    ...CLAY_INSET_INPUT_STYLE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.espresso,
  },
  sheetActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  clearBtnText: {
    color: COLORS.espresso,
    fontWeight: '800',
    fontSize: 15,
  },
  applyBtnText: {
    color: COLORS.white,
    fontWeight: '900',
    fontSize: 15,
  },
});
