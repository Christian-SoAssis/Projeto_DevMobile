import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  GestureResponderEvent,
  Image,
  Modal,
  PanResponder,
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

export interface PhotoCarouselViewerProps {
  photos: AnimalPhoto[];
  height?: number;
}

const FALLBACK_PHOTO = 'https://images.unsplash.com/photo-1543466835-00a7907e9de1';

interface ZoomablePhotoItemProps {
  uri: string;
  screenWidth: number;
  screenHeight: number;
  isActive: boolean;
  onZoomChange: (zoomed: boolean) => void;
}

/**
 * Item individual com suporte a:
 * - Gesto de pinça com 2 dedos (pinch-to-zoom) fluido e de alto alcance (até 6x),
 *   que funciona imediatamente ao encostar os dois dedos.
 * - Arraste direcionado (pan) livre para inspecionar qualquer área da foto quando ampliada.
 * - Duplo toque para zoom rápido (3.5x) e retorno para 1x.
 * - Deslize horizontal 100% desimpedido para o carrossel quando em escala normal (1x).
 */
function ZoomablePhotoItem({
  uri,
  screenWidth,
  screenHeight,
  isActive,
  onZoomChange,
}: ZoomablePhotoItemProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const currentScale = useRef(1);
  const currentPan = useRef({ x: 0, y: 0 });

  const isPinching = useRef(false);
  const isPanning = useRef(false);

  const initialDistance = useRef(0);
  const initialScale = useRef(1);
  const initialCenter = useRef({ x: 0, y: 0 });
  const initialPan = useRef({ x: 0, y: 0 });
  const startTouch = useRef({ x: 0, y: 0 });
  const isZoomedRef = useRef(false);

  const touchStartInfo = useRef<{ time: number; x: number; y: number } | null>(null);
  const lastTapTime = useRef(0);

  const resetZoom = () => {
    currentScale.current = 1;
    currentPan.current = { x: 0, y: 0 };
    if (isZoomedRef.current) {
      isZoomedRef.current = false;
      onZoomChange(false);
    }

    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 7,
      }),
      Animated.spring(pan, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: true,
        friction: 7,
      }),
    ]).start();
  };

  const zoomToPoint = (touchX: number, touchY: number, targetScale: number) => {
    const cx = screenWidth / 2;
    const cy = screenHeight / 2;
    const dx = touchX - cx;
    const dy = touchY - cy;

    const maxPanX = Math.max(0, (screenWidth * (targetScale - 1)) / 2);
    const maxPanY = Math.max(0, (screenHeight * (targetScale - 1)) / 2);

    const clampedX = Math.max(-maxPanX, Math.min(maxPanX, -dx * 0.8));
    const clampedY = Math.max(-maxPanY, Math.min(maxPanY, -dy * 0.8));

    currentScale.current = targetScale;
    currentPan.current = { x: clampedX, y: clampedY };

    if (!isZoomedRef.current) {
      isZoomedRef.current = true;
      onZoomChange(true);
    }

    Animated.parallel([
      Animated.spring(scale, {
        toValue: targetScale,
        useNativeDriver: true,
        friction: 7,
      }),
      Animated.spring(pan, {
        toValue: { x: clampedX, y: clampedY },
        useNativeDriver: true,
        friction: 7,
      }),
    ]).start();
  };

  // Se o usuário deslizar para outra foto, redefine o zoom da anterior
  useEffect(() => {
    if (!isActive && currentScale.current > 1.05) {
      resetZoom();
    }
  }, [isActive]);

  const handleGestureEnd = () => {
    isPinching.current = false;
    isPanning.current = false;
    initialDistance.current = 0;

    if (currentScale.current <= 1.08) {
      resetZoom();
    } else {
      // Zoom potente até 6.0x
      const finalScale = Math.min(6.0, Math.max(1.0, currentScale.current));
      const maxPanX = Math.max(0, (screenWidth * (finalScale - 1)) / 2);
      const maxPanY = Math.max(0, (screenHeight * (finalScale - 1)) / 2);

      const clampedX = Math.max(-maxPanX, Math.min(maxPanX, currentPan.current.x));
      const clampedY = Math.max(-maxPanY, Math.min(maxPanY, currentPan.current.y));

      currentScale.current = finalScale;
      currentPan.current = { x: clampedX, y: clampedY };

      if (!isZoomedRef.current) {
        isZoomedRef.current = true;
        onZoomChange(true);
      }

      Animated.parallel([
        Animated.spring(scale, {
          toValue: finalScale,
          useNativeDriver: true,
          friction: 7,
        }),
        Animated.spring(pan, {
          toValue: { x: clampedX, y: clampedY },
          useNativeDriver: true,
          friction: 7,
        }),
      ]).start();
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (evt) => {
          // Apenas captura no toque inicial se já forem 2 dedos (pinça) ou se a imagem já estiver ampliada
          if (evt.nativeEvent.touches.length >= 2) return true;
          return currentScale.current > 1.05;
        },
        onMoveShouldSetPanResponder: (evt, gestureState) => {
          // 2 dedos: pinça imediata
          if (evt.nativeEvent.touches.length >= 2) return true;
          // Com zoom ativo: captura arraste (pan)
          if (currentScale.current > 1.05) {
            return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
          }
          // Em 1x com 1 dedo: NÃO CAPTURA! Libera 100% para o FlatList deslizar as fotos
          return false;
        },
        onPanResponderTerminationRequest: () => currentScale.current <= 1.05,
        onPanResponderGrant: (evt) => {
          const touches = evt.nativeEvent.touches;
          if (touches.length >= 2) {
            isPinching.current = true;
            isPanning.current = false;
            const dist = Math.hypot(
              touches[0].pageX - touches[1].pageX,
              touches[0].pageY - touches[1].pageY
            );
            initialDistance.current = dist > 0 ? dist : 1;
            initialScale.current = currentScale.current;
            initialCenter.current = {
              x: (touches[0].pageX + touches[1].pageX) / 2,
              y: (touches[0].pageY + touches[1].pageY) / 2,
            };
            initialPan.current = { ...currentPan.current };
          } else if (touches.length === 1 && currentScale.current > 1.05) {
            isPanning.current = true;
            isPinching.current = false;
            startTouch.current = { x: touches[0].pageX, y: touches[0].pageY };
            initialPan.current = { ...currentPan.current };
          }
        },
        onPanResponderMove: (evt) => {
          const touches = evt.nativeEvent.touches;
          if (touches.length >= 2) {
            // Se o segundo dedo tocou milissegundos após o primeiro, inicializa a pinça imediatamente
            if (!isPinching.current || initialDistance.current <= 0) {
              isPinching.current = true;
              isPanning.current = false;
              const dist = Math.hypot(
                touches[0].pageX - touches[1].pageX,
                touches[0].pageY - touches[1].pageY
              );
              initialDistance.current = dist > 0 ? dist : 1;
              initialScale.current = currentScale.current;
              initialCenter.current = {
                x: (touches[0].pageX + touches[1].pageX) / 2,
                y: (touches[0].pageY + touches[1].pageY) / 2,
              };
              initialPan.current = { ...currentPan.current };
              return;
            }

            const currentDistance = Math.hypot(
              touches[0].pageX - touches[1].pageX,
              touches[0].pageY - touches[1].pageY
            );
            const factor = currentDistance / initialDistance.current;
            // Limite elástico amplo até 6.5x
            const newScale = Math.max(0.8, Math.min(6.5, initialScale.current * factor));

            // Direciona o zoom acompanhando o deslocamento do ponto central dos dedos
            const currentMidX = (touches[0].pageX + touches[1].pageX) / 2;
            const currentMidY = (touches[0].pageY + touches[1].pageY) / 2;
            const deltaX = currentMidX - initialCenter.current.x;
            const deltaY = currentMidY - initialCenter.current.y;

            const newPanX = initialPan.current.x + deltaX;
            const newPanY = initialPan.current.y + deltaY;

            currentScale.current = newScale;
            currentPan.current = { x: newPanX, y: newPanY };

            scale.setValue(newScale);
            pan.setValue({ x: newPanX, y: newPanY });

            if (newScale > 1.05 && !isZoomedRef.current) {
              isZoomedRef.current = true;
              onZoomChange(true);
            }
          } else if (touches.length === 1 && isPinching.current) {
            // Levantou um dos dedos durante a pinça: transiciona para arraste livre
            isPinching.current = false;
            isPanning.current = true;
            startTouch.current = { x: touches[0].pageX, y: touches[0].pageY };
            initialPan.current = { ...currentPan.current };
            initialDistance.current = 0;
          } else if (touches.length === 1 && isPanning.current && currentScale.current > 1.05) {
            // Arraste livre (pan) com 1 dedo para explorar a imagem ampliada
            const deltaX = touches[0].pageX - startTouch.current.x;
            const deltaY = touches[0].pageY - startTouch.current.y;

            const newX = initialPan.current.x + deltaX;
            const newY = initialPan.current.y + deltaY;

            const maxPanX = Math.max(0, (screenWidth * (currentScale.current - 1)) / 2) + 40;
            const maxPanY = Math.max(0, (screenHeight * (currentScale.current - 1)) / 2) + 40;

            const clampedX = Math.max(-maxPanX, Math.min(maxPanX, newX));
            const clampedY = Math.max(-maxPanY, Math.min(maxPanY, newY));

            currentPan.current = { x: clampedX, y: clampedY };
            pan.setValue({ x: clampedX, y: clampedY });
          }
        },
        onPanResponderRelease: () => {
          handleGestureEnd();
        },
        onPanResponderTerminate: () => {
          handleGestureEnd();
        },
      }),
    [screenWidth, screenHeight, onZoomChange]
  );

  const handleTouchStart = (e: GestureResponderEvent) => {
    if (e.nativeEvent.touches.length === 1) {
      touchStartInfo.current = {
        time: Date.now(),
        x: e.nativeEvent.touches[0].pageX,
        y: e.nativeEvent.touches[0].pageY,
      };
    }
  };

  const handleTouchEnd = () => {
    if (!touchStartInfo.current) return;
    const now = Date.now();
    const dt = now - touchStartInfo.current.time;

    // Se foi um toque curto (não foi um swipe arrastado)
    if (dt < 280) {
      const tapX = touchStartInfo.current.x;
      const tapY = touchStartInfo.current.y;
      const timeSinceLast = now - lastTapTime.current;

      if (timeSinceLast < 320) {
        // Duplo toque detectado!
        lastTapTime.current = 0;
        if (currentScale.current > 1.1) {
          resetZoom();
        } else {
          // Zoom profundo de 3.5x direcionado ao ponto do toque
          zoomToPoint(tapX, tapY, 3.5);
        }
      } else {
        lastTapTime.current = now;
      }
    }
    touchStartInfo.current = null;
  };

  return (
    <View
      {...panResponder.panHandlers}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={[styles.fullscreenCenter, { width: screenWidth, height: screenHeight }]}
    >
      <Animated.Image
        source={{ uri }}
        style={[
          styles.fullscreenImage,
          {
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale },
            ],
          },
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

/**
 * Decisão 16 (RF09):
 * - Carrossel com navegação horizontal livre por deslize (swipe).
 * - Toque abre visualizador em tela cheia com letterbox e fundo preto.
 * - Zoom potente por pinça com dois dedos logo de início ou duplo toque,
 *   com direcionamento livre por arraste.
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
    // Sincroniza a visualização do card principal com a última foto visualizada
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
          {/* Barra superior limpa: apenas contador e botão de fechar */}
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

          {/* Carrossel em tela cheia com deslize horizontal fluido */}
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

          {/* Indicadores de página no rodapé */}
          {validUris.length > 1 && (
            <View style={styles.fullscreenBottomBar}>
              <View style={styles.dotsRow}>
                {validUris.map((_, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.dot,
                      idx === activeIndex && styles.dotActive,
                    ]}
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
  fullscreenCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
  fullscreenBottomBar: {
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
