import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Animal } from '../../domain/entities/Animal';

export interface AnimalCoverProps {
  animal: Animal;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

/** Primeira foto do anúncio (remota ou local); mostra um placeholder sem foto ou se ela falhar ao carregar. */
export const AnimalCover: React.FC<AnimalCoverProps> = ({ animal, height = 160, style }) => {
  const [failed, setFailed] = useState(false);
  const uri = animal.photos[0]?.displayUrl;

  if (!uri || failed) {
    return (
      <View style={[styles.placeholder, { height }, style]} testID={`animal-cover-placeholder-${animal.id}`}>
        <Text style={styles.placeholderIcon}>🐾</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={[styles.image, { height }, style as object]}
      resizeMode="cover"
      accessibilityLabel={`Foto de ${animal.name}`}
      onError={() => setFailed(true)}
      testID={`animal-cover-${animal.id}`}
    />
  );
};

const styles = StyleSheet.create({
  image: {
    width: '100%',
    borderRadius: 8,
    backgroundColor: '#e5e5ea',
  },
  placeholder: {
    width: '100%',
    borderRadius: 8,
    backgroundColor: '#e5e5ea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 36,
  },
});
