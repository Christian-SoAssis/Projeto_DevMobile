import React, { useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnimalPhoto } from '../../domain/entities/AnimalPhoto';
import { COLORS, RADII } from '../theme/tokens';
import { ZoomablePhotoItem } from './ZoomablePhotoItem';

export interface PhotoCarouselViewerProps {
  photos: AnimalPhoto[];
  height?: number;
}

const FALLBACK_PHOTO = 'https://images.unsplash.com/photo-1543466835-00a7907e9de1';

/**
 * Decisão 16 (RF09):
 * - Carrossel com navegação horizontal livre por deslize (swipe).
 * - Toque abre visualizador em tela cheia com letterbox e fundo preto.
 * - Zoom potente por pinça com dois dedos logo de início ou duplo toque,
 *   delegado ao subcomponente `ZoomablePhotoItem`.
 */
export function PhotoCarouselViewer({ photos, height = 270 }: PhotoCarouselViewerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const heroWidth = screenWidth - 36;

  const heroScrollRef = useRef<ScrollView>(null);
  const flatListRef = useRef<FlatList>(null);

  const validUris =
    photos.length > 0
      ? photos.map((p) => p.displayUri || FALLBACK_PHOTO)
      : [FALLBACK_PHOTO];

  const openAt = (index: number) => {
    setActiveIndex(index);
    setIsZoomed(false);
    setFullscreenOpen(true);
  };

  const closeFullscreen = () => {
    setFullscreenOpen(false);
    setIsZoomed(false);
    heroScrollRef.current?.scrollTo({
      x: activeIndex * heroWidth,
      animated: false,
    });
  };

  return (
    <View style={styles.wrapper}>
      {validUris.length === 1 ? (
        <TouchableOpacity
          activeOpacity={0.92}
          accessibilityRole="imagebutton"
          accessibilityLabel="Ampliar foto do animal em tela cheia"
          onPress={() => openAt(0)}
          style={[styles.heroContainer, { height }]}
        >
          <Image
            source={{ uri: validUris[0] }}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <View style={styles.zoomHintPill}>
            <Ionicons name="expand-outline" size={14} color={COLORS.white} />
            <Text style={styles.zoomHintText}>Toque para ampliar</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={[styles.heroContainer, { height }]}>
          <ScrollView
            ref={heroScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const page = Math.round(e.nativeEvent.contentOffset.x / heroWidth);
              setActiveIndex(Math.max(0, Math.min(validUris.length - 1, page)));
            }}
          >
            {validUris.map((uri, idx) => (
              <TouchableOpacity
                key={`${uri}_${idx}`}
                activeOpacity={0.92}
                onPress={() => openAt(idx)}
                style={{ width: heroWidth, height }}
              >
                <Image
                  source={{ uri }}
                  style={styles.heroImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.dotsRow}>
            {validUris.map((_, idx) => (
              <View
                key={idx}
                style={[styles.dot, idx === activeIndex && styles.dotActive]}
              />
            ))}
          </View>
        </View>
      )}

      <Modal
        visible={fullscreenOpen}
        transparent
        animationType="fade"
        onRequestClose={closeFullscreen}
      >
        <View style={styles.fullscreenBackdrop}>
          <View style={styles.fullscreenTopBar}>
            <Text style={styles.fullscreenCounter}>
              {activeIndex + 1} / {validUris.length}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Fechar tela cheia"
              onPress={closeFullscreen}
              style={styles.fullscreenIconBtn}
            >
              <Ionicons name="close" size={24} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          <FlatList
            ref={flatListRef}
            data={validUris}
            keyExtractor={(item, idx) => `${item}_${idx}`}
            horizontal
            pagingEnabled
            scrollEnabled={!isZoomed}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={activeIndex}
            removeClippedSubviews={false}
            getItemLayout={(_, index) => ({
              length: screenWidth,
              offset: screenWidth * index,
              index,
            })}
            onMomentumScrollEnd={(e) => {
              const page = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
              if (page >= 0 && page < validUris.length) {
                setActiveIndex(page);
                setIsZoomed(false);
              }
            }}
            renderItem={({ item, index }) => (
              <ZoomablePhotoItem
                uri={item}
                screenWidth={screenWidth}
                screenHeight={screenHeight - 120}
                isActive={index === activeIndex}
                onZoomChange={setIsZoomed}
              />
            )}
          />

          {validUris.length > 1 && (
            <View style={styles.fullscreenBottomBar}>
              <View style={styles.dotsRow}>
                {validUris.map((_, idx) => (
                  <View
                    key={idx}
                    style={[styles.dot, idx === activeIndex && styles.dotActive]}
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  heroContainer: {
    width: '100%',
    borderRadius: RADII.lg,
    overflow: 'hidden',
    backgroundColor: COLORS.peach,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  zoomHintPill: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(58, 31, 20, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADII.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  zoomHintText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  dotActive: {
    width: 20,
    backgroundColor: COLORS.terracotta,
  },
  fullscreenBackdrop: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingBottom: 24,
  },
  fullscreenTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  fullscreenCounter: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  fullscreenIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenBottomBar: {
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
