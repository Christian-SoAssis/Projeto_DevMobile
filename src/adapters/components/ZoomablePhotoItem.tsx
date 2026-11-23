import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  GestureResponderEvent,
  PanResponder,
  StyleSheet,
  View,
} from 'react-native';

export interface ZoomablePhotoItemProps {
  uri: string;
  screenWidth: number;
  screenHeight: number;
  isActive: boolean;
  onZoomChange: (zoomed: boolean) => void;
}

/**
 * Item individual com suporte a:
 * - Gesto de pinça com 2 dedos (pinch-to-zoom) fluido e de alto alcance (até 6x).
 * - Arraste direcionado (pan) livre para inspecionar qualquer área da foto quando ampliada.
 * - Duplo toque para zoom rápido (3.5x) e retorno para 1x.
 * - Deslize horizontal 100% desimpedido para o carrossel quando em escala normal (1x).
 */
export function ZoomablePhotoItem({
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
          if (evt.nativeEvent.touches.length >= 2) return true;
          return currentScale.current > 1.05;
        },
        onMoveShouldSetPanResponder: (evt, gestureState) => {
          if (evt.nativeEvent.touches.length >= 2) return true;
          if (currentScale.current > 1.05) {
            return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
          }
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
            const newScale = Math.max(0.8, Math.min(6.5, initialScale.current * factor));

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
            isPinching.current = false;
            isPanning.current = true;
            startTouch.current = { x: touches[0].pageX, y: touches[0].pageY };
            initialPan.current = { ...currentPan.current };
            initialDistance.current = 0;
          } else if (touches.length === 1 && isPanning.current && currentScale.current > 1.05) {
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

    if (dt < 280) {
      const tapX = touchStartInfo.current.x;
      const tapY = touchStartInfo.current.y;
      const timeSinceLast = now - lastTapTime.current;

      if (timeSinceLast < 320) {
        lastTapTime.current = 0;
        if (currentScale.current > 1.1) {
          resetZoom();
        } else {
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
            transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale }],
          },
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fullscreenCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
});
