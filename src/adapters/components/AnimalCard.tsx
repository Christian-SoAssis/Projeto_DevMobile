import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Animal } from '../../domain/entities/Animal';
import { CLAY_CARD_STYLE, COLORS, RADII } from '../theme/tokens';

export const ANIMAL_FALLBACK_PHOTO =
  'https://images.unsplash.com/photo-1543466835-00a7907e9de1';

export interface AnimalCardProps {
  animal: Animal;
  isFavorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
}

export function AnimalCard({
  animal,
  isFavorite,
  onPress,
  onToggleFavorite,
}: AnimalCardProps) {
  const photoUri = animal.photos[0]?.displayUri || ANIMAL_FALLBACK_PHOTO;

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={styles.animalCard}>
      <Image source={{ uri: photoUri }} style={styles.animalThumb} />
      <View style={styles.animalInfo}>
        <View style={styles.animalHeaderRow}>
          <Text style={styles.animalName}>{animal.name}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Favoritar anúncio"
            onPress={onToggleFavorite}
            style={styles.heartBtn}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={20}
              color={COLORS.terracotta}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.badgeAvailable}>
          <Text style={styles.badgeAvailableText}>
            {animal.status.isAvailable() ? 'Disponível' : 'Adotado'}
          </Text>
        </View>

        <Text style={styles.metaText}>
          🐾 {animal.characteristics.approximateAge} • {animal.characteristics.sex}
        </Text>
        <Text style={styles.metaText}>🐾 {animal.characteristics.size}</Text>
        <Text style={styles.locationMetaText}>📍 {animal.location.displayLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  animalCard: {
    ...CLAY_CARD_STYLE,
    flexDirection: 'row',
    padding: 12,
    gap: 12,
    alignItems: 'center',
  },
  animalThumb: {
    width: 106,
    height: 106,
    borderRadius: 18,
    backgroundColor: COLORS.peach,
  },
  animalInfo: {
    flex: 1,
  },
  animalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  animalName: {
    fontSize: 19,
    fontWeight: '900',
    color: COLORS.espresso,
  },
  heartBtn: {
    padding: 4,
  },
  badgeAvailable: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.green,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADII.pill,
    marginVertical: 4,
  },
  badgeAvailableText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '800',
  },
  metaText: {
    fontSize: 12,
    color: COLORS.brown,
    fontWeight: '700',
    marginTop: 1,
  },
  locationMetaText: {
    fontSize: 12,
    color: COLORS.espresso,
    fontWeight: '800',
    marginTop: 2,
  },
});
