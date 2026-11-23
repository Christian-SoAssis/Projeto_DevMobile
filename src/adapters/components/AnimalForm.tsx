import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  MAX_ANIMAL_NAME_LENGTH,
  MAX_PHOTOS_PER_ANIMAL,
} from '../../domain/entities/Animal';
import {
  MAX_APPROXIMATE_AGE_LENGTH,
  MAX_CHARACTERISTICS_TEXT_LENGTH,
} from '../../domain/value-objects/AnimalCharacteristics';
import { MAX_LOCATION_TEXT_LENGTH } from '../../domain/value-objects/ApproximateLocation';
import { AnimalFormPhotoItem } from '../hooks/useAnimalForm';
import {
  CLAY_CARD_STYLE,
  CLAY_INSET_INPUT_STYLE,
  CLAY_PRIMARY_BUTTON_STYLE,
  COLORS,
  RADII,
  SPACING,
} from '../theme/tokens';

export interface AnimalFormProps {
  photos: AnimalFormPhotoItem[];
  onCaptureCamera: () => void;
  onPickGallery: () => void;
  onRemovePhotoAt: (index: number) => void;
  name: string;
  onChangeName: (v: string) => void;
  species: string;
  onChangeSpecies: (v: string) => void;
  sex: string;
  onChangeSex: (v: string) => void;
  size: string;
  onChangeSize: (v: string) => void;
  approximateAge: string;
  onChangeApproximateAge: (v: string) => void;
  behavior: string;
  onChangeBehavior: (v: string) => void;
  specialCare: string;
  onChangeSpecialCare: (v: string) => void;
  neighborhood: string;
  onChangeNeighborhood: (v: string) => void;
  city: string;
  onChangeCity: (v: string) => void;
  locGeocoded: boolean;
  locating: boolean;
  onUseMyLocation: () => void;
  saving: boolean;
  submitLabel: string;
  savingLabel: string;
  onSubmit: () => void;
}

export function AnimalForm({
  photos,
  onCaptureCamera,
  onPickGallery,
  onRemovePhotoAt,
  name,
  onChangeName,
  species,
  onChangeSpecies,
  sex,
  onChangeSex,
  size,
  onChangeSize,
  approximateAge,
  onChangeApproximateAge,
  behavior,
  onChangeBehavior,
  specialCare,
  onChangeSpecialCare,
  neighborhood,
  onChangeNeighborhood,
  city,
  onChangeCity,
  locGeocoded,
  locating,
  onUseMyLocation,
  saving,
  submitLabel,
  savingLabel,
  onSubmit,
}: AnimalFormProps) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          Fotos do pet ({photos.length}/{MAX_PHOTOS_PER_ANIMAL})
        </Text>
        <View style={styles.photoGrid}>
          {photos.map((item, index) => (
            <View key={`${item.id ?? item.uri}-${index}`} style={styles.photoThumbWrap}>
              <Image source={{ uri: item.uri }} style={styles.photoThumb} />
              <Pressable
                style={styles.removePhotoBtn}
                onPress={() => onRemovePhotoAt(index)}
              >
                <Ionicons name="close" size={14} color={COLORS.white} />
              </Pressable>
            </View>
          ))}
        </View>
        <View style={styles.photoButtonsRow}>
          <TouchableOpacity style={styles.photoActionBtn} onPress={onCaptureCamera}>
            <Ionicons name="camera-outline" size={18} color={COLORS.terracotta} />
            <Text style={styles.photoActionText}>Câmera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoActionBtn} onPress={onPickGallery}>
            <Ionicons name="images-outline" size={18} color={COLORS.terracotta} />
            <Text style={styles.photoActionText}>Galeria</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Nome do animal</Text>
        <TextInput
          style={CLAY_INSET_INPUT_STYLE}
          value={name}
          onChangeText={onChangeName}
          placeholder="Ex.: Amora, Bento..."
          placeholderTextColor={COLORS.brownMuted}
          maxLength={MAX_ANIMAL_NAME_LENGTH}
        />

        <Text style={styles.label}>Espécie</Text>
        <View style={styles.chipsRow}>
          {(['Cão', 'Gato'] as const).map((sp) => (
            <Pressable
              key={sp}
              style={[styles.chip, species === sp && styles.chipActive]}
              onPress={() => onChangeSpecies(sp)}
            >
              <Text style={[styles.chipText, species === sp && styles.chipTextActive]}>{sp}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Sexo</Text>
        <View style={styles.chipsRow}>
          {(['Fêmea', 'Macho'] as const).map((sx) => (
            <Pressable
              key={sx}
              style={[styles.chip, sex === sx && styles.chipActive]}
              onPress={() => onChangeSex(sx)}
            >
              <Text style={[styles.chipText, sex === sx && styles.chipTextActive]}>{sx}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Porte</Text>
        <View style={styles.chipsRow}>
          {(['Pequeno', 'Médio', 'Grande'] as const).map((sz) => (
            <Pressable
              key={sz}
              style={[styles.chip, size === sz && styles.chipActive]}
              onPress={() => onChangeSize(sz)}
            >
              <Text style={[styles.chipText, size === sz && styles.chipTextActive]}>{sz}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Idade aproximada</Text>
        <TextInput
          style={CLAY_INSET_INPUT_STYLE}
          value={approximateAge}
          onChangeText={onChangeApproximateAge}
          placeholder="Ex.: 8 meses, 2 anos"
          placeholderTextColor={COLORS.brownMuted}
          maxLength={MAX_APPROXIMATE_AGE_LENGTH}
        />

        <Text style={styles.label}>Comportamento (opcional)</Text>
        <TextInput
          style={[CLAY_INSET_INPUT_STYLE, styles.textArea]}
          value={behavior}
          onChangeText={onChangeBehavior}
          placeholder="Conte como é o temperamento, convivência com outros animais..."
          placeholderTextColor={COLORS.brownMuted}
          maxLength={MAX_CHARACTERISTICS_TEXT_LENGTH}
          multiline
        />

        <Text style={styles.label}>Cuidados especiais (opcional)</Text>
        <TextInput
          style={CLAY_INSET_INPUT_STYLE}
          value={specialCare}
          onChangeText={onChangeSpecialCare}
          placeholder="Ex.: Vacinado, castrado, medicação..."
          placeholderTextColor={COLORS.brownMuted}
          maxLength={MAX_CHARACTERISTICS_TEXT_LENGTH}
        />
      </View>

      <View style={styles.card}>
        <View style={styles.locHeader}>
          <Text style={styles.sectionTitle}>Localização aproximada</Text>
          <TouchableOpacity
            style={styles.gpsButton}
            onPress={onUseMyLocation}
            disabled={locating}
          >
            {locating ? (
              <ActivityIndicator size="small" color={COLORS.green} />
            ) : (
              <>
                <Ionicons name="locate-outline" size={16} color={COLORS.green} />
                <Text style={styles.gpsButtonText}>Usar minha localização</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Bairro</Text>
        <TextInput
          style={CLAY_INSET_INPUT_STYLE}
          value={neighborhood}
          onChangeText={onChangeNeighborhood}
          placeholder="Ex.: Centro, Vila Pinto"
          placeholderTextColor={COLORS.brownMuted}
          maxLength={MAX_LOCATION_TEXT_LENGTH}
        />

        <Text style={styles.label}>Cidade</Text>
        <TextInput
          style={CLAY_INSET_INPUT_STYLE}
          value={city}
          onChangeText={onChangeCity}
          placeholder="Ex.: Varginha"
          placeholderTextColor={COLORS.brownMuted}
          maxLength={MAX_LOCATION_TEXT_LENGTH}
        />
        {!locGeocoded && !locating && (
          <Text style={styles.locNotGeocodedText}>
            Bairro/cidade não identificados automaticamente — preenchidos com valores padrão.
          </Text>
        )}
      </View>

      <TouchableOpacity
        style={CLAY_PRIMARY_BUTTON_STYLE}
        onPress={onSubmit}
        disabled={saving}
      >
        <Text style={styles.saveButtonText}>{saving ? savingLabel : submitLabel}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl * 2,
    gap: SPACING.md,
  },
  card: {
    ...CLAY_CARD_STYLE,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.espresso,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  photoThumbWrap: {
    width: 74,
    height: 74,
    borderRadius: RADII.md,
    overflow: 'hidden',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButtonsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  photoActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.amberBg,
  },
  photoActionText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.terracotta,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.brown,
    marginTop: 4,
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.ivory,
    borderWidth: 1,
    borderColor: COLORS.peach,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: COLORS.terracotta,
    borderColor: COLORS.terracotta,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.brown,
  },
  chipTextActive: {
    color: COLORS.white,
  },
  locHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.greenBg,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADII.pill,
  },
  gpsButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.green,
  },
  locNotGeocodedText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.brown,
    marginTop: 4,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '900',
  },
});
