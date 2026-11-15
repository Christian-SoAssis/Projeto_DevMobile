import React, { useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnimalPhoto } from '../../domain/entities/AnimalPhoto';
import { COLORS, RADII } from '../theme/tokens';

export interface PhotoCarouselViewerProps {
  photos: AnimalPhoto[];
  height?: number;
}

const FALLBACK_PHOTO = 'https://images.unsplash.com/photo-1543466835-00a7907e9de1';

/**
 * Decisão 16 (RF09):
 * - 1 foto: foto simples tocável (sem indicador de carrossel).
 * - ≥ 2 fotos: carrossel horizontal com indicadores.
 * - Toque abre visualizador em tela cheia com letterbox (`resizeMode="contain"`, fundo preto)
 *   e controle de zoom (1x a 4x) + navegação entre fotos.
 */
export function PhotoCarouselViewer({ photos, height = 270 }: PhotoCarouselViewerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const screenWidth = Dimensions.get('window').width;
  const heroWidth = screenWidth - 36;

  const validUris =
    photos.length > 0
      ? photos.map((p) => p.displayUri || FALLBACK_PHOTO)
      : [FALLBACK_PHOTO];

  const openAt = (index: number) => {
    setActiveIndex(index);
    setZoomScale(1);
    setFullscreenOpen(true);
  };

  const toggleZoom = () => {
    setZoomScale((prev) => (prev >= 3 ? 1 : prev + 1));
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
        onRequestClose={() => setFullscreenOpen(false)}
      >
        <View style={styles.fullscreenBackdrop}>
          <View style={styles.fullscreenTopBar}>
            <Text style={styles.fullscreenCounter}>
              {activeIndex + 1} / {validUris.length} • Zoom {zoomScale}x
            </Text>
            <View style={styles.fullscreenActions}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Alternar nível de zoom"
                onPress={toggleZoom}
                style={styles.fullscreenIconBtn}
              >
                <Ionicons name="search-outline" size={20} color={COLORS.white} />
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Fechar tela cheia"
                onPress={() => setFullscreenOpen(false)}
                style={styles.fullscreenIconBtn}
              >
                <Ionicons name="close" size={24} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {
              if (zoomScale === 1) setFullscreenOpen(false);
              else setZoomScale(1);
            }}
            style={styles.fullscreenCenter}
          >
            <Image
              source={{ uri: validUris[activeIndex] || validUris[0] }}
              style={[
                styles.fullscreenImage,
                { transform: [{ scale: zoomScale }] },
              ]}
              resizeMode="contain"
            />
          </TouchableOpacity>

          {validUris.length > 1 && (
            <View style={styles.fullscreenBottomNav}>
              <TouchableOpacity
                disabled={activeIndex === 0}
                onPress={() => {
                  setZoomScale(1);
                  setActiveIndex((i) => Math.max(0, i - 1));
                }}
                style={[
                  styles.navPillBtn,
                  activeIndex === 0 && styles.navPillBtnDisabled,
                ]}
              >
                <Ionicons name="chevron-back" size={18} color={COLORS.white} />
                <Text style={styles.navPillText}>Anterior</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={activeIndex === validUris.length - 1}
                onPress={() => {
                  setZoomScale(1);
                  setActiveIndex((i) => Math.min(validUris.length - 1, i + 1));
                }}
                style={[
                  styles.navPillBtn,
                  activeIndex === validUris.length - 1 && styles.navPillBtnDisabled,
                ]}
              >
                <Text style={styles.navPillText}>Próxima</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.white} />
              </TouchableOpacity>
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
    paddingVertical: 44,
  },
  fullscreenTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  fullscreenCounter: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  fullscreenActions: {
    flexDirection: 'row',
    gap: 12,
  },
  fullscreenIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
  fullscreenBottomNav: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 20,
  },
  navPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(194, 81, 46, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADII.pill,
  },
  navPillBtnDisabled: {
    opacity: 0.35,
  },
  navPillText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 13,
  },
});
