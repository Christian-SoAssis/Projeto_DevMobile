import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  GestureResponderEvent,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { AnimalPhoto } from '../../domain/entities/AnimalPhoto';
import { AnimalPhotoView } from './AnimalPhotoView';

export interface PhotoViewerPage {
  photo?: AnimalPhoto | null;
  uri?: string | null;
}

export interface PhotoViewerProps {
  visible: boolean;
  pages: PhotoViewerPage[];
  /** Posição inicial: a foto que abriu o visualizador. */
  initialIndex?: number;
  onClose: () => void;
  /** Base dos testIDs: `${testID}-close`, `${testID}-photo-N` e `${testID}-position`. */
  testID?: string;
  /**
   * RF09 + decisão 16: faixa de zoom da visualização em tela cheia. O zoom
   * nativo do `ScrollView` (`maximumZoomScale`) existe SÓ no iOS — o
   * `ReactScrollView` do Android não implementa escala — e a decisão de
   * produto exige pinça 1x–4x nas duas plataformas SEM dependência nova.
   * A pinça é implementada com `PanResponder` (core do RN) e os cálculos
   * ficam em helpers puros, testáveis.
   * Enquanto ampliada, o arrasto 1-dedo desloca a foto; soltar na escala 1
   * volta ao enquadramento e dispensa o gesto (o carrossel volta a reger).
   */
}

export const ZOOM_MIN_SCALE = 1;
export const ZOOM_MAX_SCALE = 4;

export function clampZoom(scale: number): number {
  if (!Number.isFinite(scale) || scale <= ZOOM_MIN_SCALE) return ZOOM_MIN_SCALE;
  return Math.min(scale, ZOOM_MAX_SCALE);
}

/** Distância em px entre os 2 primeiros toques da pinça (0 quando < 2 dedos). */
export function pinchDistance(event: GestureResponderEvent): number {
  const touches = event.nativeEvent.touches;
  if (touches.length < 2) return 0;
  const [a, b] = [touches[0], touches[1]];
  const dx = a.pageX - b.pageX;
  const dy = a.pageY - b.pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Deslocamento da foto ampliada: a imagem ampla exempla os limites da
 * página pelo fator de escala — o arrasto é contido neles ("borda para
 * ir além" evita a foto perdida fora da tela).
 */
export function clampPan(
  pan: { x: number; y: number },
  scale: number,
  page: { width: number; height: number }
): { x: number; y: number } {
  const maxX = (page.width * (scale - ZOOM_MIN_SCALE)) / 2;
  const maxY = (page.height * (scale - ZOOM_MIN_SCALE)) / 2;
  const x = Math.min(Math.max(pan.x, -maxX), maxX);
  const y = Math.min(Math.max(pan.y, -maxY), maxY);
  // -0 → +0 (.deepEqual/Object.is distinguem; o pan real nunca depende do sinal).
  return { x: x === 0 ? 0 : x, y: y === 0 ? 0 : y };
}

const ZoomablePhoto: React.FC<{
  page: PhotoViewerPage;
  width: number;
  height: number;
  testID?: string;
}> = ({ page, width, height, testID }) => {
  const [zoom, setZoom] = useState({ scale: ZOOM_MIN_SCALE, pan: { x: 0, y: 0 } });
  const gesture = useRef({
    scale: ZOOM_MIN_SCALE,
    baseScale: ZOOM_MIN_SCALE,
    baseDistance: 0,
    pan: { x: 0, y: 0 },
  });
  const lastTouch = useRef<{ x: number; y: number } | null>(null);

  const apply = () => setZoom({ scale: gesture.current.scale, pan: gesture.current.pan });

  const resetZoom = () => {
    gesture.current.scale = ZOOM_MIN_SCALE;
    gesture.current.pan = { x: 0, y: 0 };
    gesture.current.baseDistance = 0;
    lastTouch.current = null;
    apply();
  };

  const handlers = useRef(
    PanResponder.create({
      // 1 dedo em 1x: o ScrollView horizontal regula a troca de fotos. O
      // gesto do zoom só reivindica o responder com 2 dedos (ou arraste
      // quando a foto já está ampliada).
      onMoveShouldSetPanResponder: (_e, g) =>
        g.numberActiveTouches === 2 || gesture.current.scale > ZOOM_MIN_SCALE,
      onPanResponderGrant: () => {
        // Arraste com a foto ampliada começa de onde ela já está — os
        // incrementos vêm de `lastTouch` no `onPanResponderMove`.
      },
      onPanResponderMove: (event, g) => {
        const t0 = event.nativeEvent.touches[0];
        if (g.numberActiveTouches >= 2) {
          const distance = pinchDistance(event);
          const cur = gesture.current;
          if (cur.baseDistance <= 0) {
            // 2º dedo chegou no meio do gesto: ancora a base agora.
            cur.baseDistance = distance;
            cur.baseScale = cur.scale;
          } else if (distance > 0) {
            cur.scale = clampZoom((cur.baseScale * distance) / cur.baseDistance);
          }
        } else if (g.numberActiveTouches === 1 && gesture.current.scale > ZOOM_MIN_SCALE && lastTouch.current) {
          const cur = gesture.current;
          cur.pan = clampPan(
            {
              x: cur.pan.x + (t0.pageX - lastTouch.current.x),
              y: cur.pan.y + (t0.pageY - lastTouch.current.y),
            },
            cur.scale,
            { width, height }
          );
        }
        lastTouch.current = t0 ? { x: t0.pageX, y: t0.pageY } : null;
        apply();
      },
      onPanResponderRelease: () => {
        if (gesture.current.scale <= ZOOM_MIN_SCALE + 0.001) resetZoom();
        else {
          gesture.current.baseDistance = 0;
          lastTouch.current = null;
        }
        apply();
      },
      onPanResponderTerminate: resetZoom,
    })
  ).current;

  return (
    <View style={{ width, height }} {...handlers.panHandlers}>
      <AnimalPhotoView
        photo={page.photo}
        uri={page.uri}
        testID={testID}
        style={{
          width,
          height,
          borderRadius: 0,
          transform: [
            { translateX: zoom.pan.x / zoom.scale },
            { translateY: zoom.pan.y / zoom.scale },
            { scale: zoom.scale },
          ],
        }}
      />
    </View>
  );
};

/**
 * RF09 + decisão 16: visualizador de fotos do anúncio em TELA CHEIA com
 * zoom por pinça (1x–4x) e deslizar entre as fotos. Fundo escuro, indicação
 * "n/total" e fechar com ✕ (ou botão de voltar no Android, via
 * `onRequestClose`). Sem texto técnico (UI-09); funciona offline — as fotos
 * reutilizam `AnimalPhotoView` (resolução local-primeiro, RNF01/RNF02).
 */
export const PhotoViewer: React.FC<PhotoViewerProps> = ({
  visible,
  pages,
  initialIndex = 0,
  onClose,
  testID = 'photo-viewer',
}) => {
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const lastPage = useRef(initialIndex);
  const [position, setPosition] = useState(initialIndex);
  const { width, height } = Dimensions.get('window');

  // Reabre na foto pedida (ex.: tocar na 2ª do carrossel abre na 2ª).
  useEffect(() => {
    if (!visible) return;
    lastPage.current = initialIndex;
    setPosition((prev) => (prev === initialIndex ? prev : initialIndex));
    scrollRef.current?.scrollTo({ x: initialIndex * width, animated: false });
  }, [visible, initialIndex, width]);

  // Fechado: nada renderiza (o conteúdo nunca vaza para a árvore/UI). REGRA
  // DOS HOOKS: o early return precisa vir DEPOIS de TODOS os hooks — a tela
  // hospedeira mantém o <PhotoViewer> montado com visible=false; se o hook
  // nascesse condicional, a contagem mudaria entre renderizações
  // ("Rendered more hooks than during the previous render").
  if (!visible) return null;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = event.nativeEvent.contentOffset.x;
    if (width <= 0) return;
    const target = Math.min(Math.max(Math.round(offset / width), 0), Math.max(0, pages.length - 1));
    if (lastPage.current === target) return;
    lastPage.current = target;
    setPosition(target);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.header}>
          {pages.length > 1 && (
            <Text style={styles.counter} testID={`${testID}-position`}>
              {position + 1}/{pages.length}
            </Text>
          )}
          <View style={styles.spacer} />
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            testID={`${testID}-close`}
            accessibilityLabel="Fechar visualizador de fotos"
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          testID={`${testID}-scroll`}
        >
          {pages.map((page, index) => (
            <ZoomablePhoto
              key={index}
              page={page}
              width={width}
              height={height}
              testID={`${testID}-photo-${index}`}
            />
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000000ee',
  },
  header: {
    position: 'absolute',
    top: 48,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  counter: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  spacer: {
    flex: 1,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
