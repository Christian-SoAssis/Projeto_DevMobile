import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
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
  /** Base dos testIDs: `${testID}-close`, `${testID}-photo-N`, `${testID}-scroll` e `${testID}-position`. */
  testID?: string;
  /**
   * RF09 + decisão 16: faixa de zoom da visualização em tela cheia. O zoom
   * nativo do `ScrollView` (`maximumZoomScale`) existe SÓ no iOS — o
   * `ReactScrollView` do Android não implementa escala.
   * Relatório em device (07/11/2026): a pinça via `PanResponder` (JS) perde a
   * disputa por toques contra o `ScrollView` horizontal nativo — a pinça
   * NUNCA chegava ao gesto. Decisão B2 aprovada: **dependência mínima
   * `react-native-gesture-handler`** — os gestos são negociados no nativo
   * (`Gesture.Pinch()` + `Gesture.Pan()` simultâneos via `GestureDetector`,
   * um detector POR PÁGINA: o zoom funciona em cada foto, inclusive depois
   * de deslizar para outra dentro do visualizador). Enquanto ampliada, o
   * arrasto 1-dedo desloca a foto e a paginação do `ScrollView` fica
   * desligada (`scrollEnabled={false}`), evitando a disputa de gestos; soltar
   * a pinça em 1x reativa a paginação e volta ao enquadramento.
   */
}

export const ZOOM_MIN_SCALE = 1;
export const ZOOM_MAX_SCALE = 4;
/** Soltar a pinça até este valor conta como "voltou ao enquadramento". */
export const ZOOM_RESET_EPSILON = 0.05;

export function clampZoom(scale: number): number {
  if (!Number.isFinite(scale) || scale <= ZOOM_MIN_SCALE) return ZOOM_MIN_SCALE;
  return Math.min(scale, ZOOM_MAX_SCALE);
}

/**
 * Deslocamento da foto ampliada: a imagem amplia os limites da
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

/**
 * Uma página do visualizador: foto com letterbox (`contain`, fundo preto,
 * centrada — decisão do usuário 07/11/2026: foto em outra proporção aparece
 * INTEIRA, sem corte; barras pretas só no visualizador) + gestos de zoom.
 *
 * O zoom tem estado local por página: deslizar para outra foto NÃO zera
 * implicitamente (só o novo `resetToken` — reabrir o visualizador — reseta),
 * e cada página tem seus próprios gestos, então o zoom vale em cada foto.
 */
const ZoomablePhoto: React.FC<{
  page: PhotoViewerPage;
  width: number;
  height: number;
  /** Incrementa a cada abertura do visualizador: volta o zoom ao enquadramento. */
  resetToken: number;
  onZoomChange?: (zoomed: boolean) => void;
  testID?: string;
}> = ({ page, width, height, resetToken, onZoomChange, testID }) => {
  const [zoom, setZoom] = useState({ scale: ZOOM_MIN_SCALE, pan: { x: 0, y: 0 } });
  // Estado do gesto em ref (os callbacks do gesture-handler não recriam o
  // gesto a cada update) + `apply()` para refletir na UI.
  const gesture = useRef({
    scale: ZOOM_MIN_SCALE,
    baseScale: ZOOM_MIN_SCALE,
    pan: { x: 0, y: 0 },
    basePan: { x: 0, y: 0 },
  });
  const reported = useRef(false);

  const apply = () => setZoom({ scale: gesture.current.scale, pan: { ...gesture.current.pan } });

  /** Avisa a tela hospedeira quando cruza a fronteira 1x ↔ ampliado. */
  const report = () => {
    const zoomed = gesture.current.scale > ZOOM_MIN_SCALE;
    if (zoomed !== reported.current) {
      reported.current = zoomed;
      onZoomChange?.(zoomed);
    }
  };

  // Reabrir o visualizador (novo gesto, foto nova) volta o zoom ao início.
  useEffect(() => {
    if (reported.current) {
      reported.current = false;
      onZoomChange?.(false);
    }
    gesture.current.scale = ZOOM_MIN_SCALE;
    gesture.current.pan = { x: 0, y: 0 };
    apply();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken]);

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        // Expo Go embute o Reanimated/Worklets; sem runOnJS o RNGH auto-envia
        // os callbacks para a thread da UI (worklet) — onde mutar o ref JS e
        // aplicar o state do React são proibidos ("Tried to modify key
        // \`scale\`/`pan` of an object … passed to a worklet"): o zoom morria
        // na fronteira JS↔worklet (warnings + crash intermitente). Com
        // runOnJS os callbacks rodam na thread do JS — mesmo modelo do
        // PanResponder anterior — e o state reflete 1:1.
        .runOnJS(true)
        .onBegin(() => {
          // Gesto novo parte da escala corrente (ex.: 2x → pinça a partir daí).
          gesture.current.baseScale = gesture.current.scale;
        })
        .onUpdate((event) => {
          gesture.current.scale = clampZoom(gesture.current.baseScale * event.scale);
          gesture.current.pan = clampPan(gesture.current.pan, gesture.current.scale, {
            width,
            height,
          });
          apply();
          report();
        })
        .onEnd(() => {
          if (gesture.current.scale <= ZOOM_MIN_SCALE + ZOOM_RESET_EPSILON) {
            // Voltou ao enquadramento: zera também o arrasto (a foto volta a
            // preencher a página e o carrossel volta a reger a paginação).
            gesture.current.scale = ZOOM_MIN_SCALE;
            gesture.current.pan = { x: 0, y: 0 };
            apply();
            report();
          } else {
            gesture.current.baseScale = gesture.current.scale;
          }
        }),
    // página tem dimensões fixas (janela) — o gesto é estável durante ela
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, height]
  );

  const zoomed = zoom.scale > ZOOM_MIN_SCALE;
  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Mesmo motivo do pinch: callbacks na thread do JS (ver comentário
        // acima sobre worklets do Expo Go).
        .runOnJS(true)
        // Só quando ampliada: em 1x o carrossel horizontal regula a troca de
        // fotos sem disputa de gesto (sem Pan ativo, o scroll nativo vence).
        .enabled(zoomed)
        .onStart(() => {
          // O arrasto parte de onde a foto já está (gestos encadeados somam).
          gesture.current.basePan = { ...gesture.current.pan };
        })
        .onUpdate((event) => {
          gesture.current.pan = clampPan(
            {
              x: gesture.current.basePan.x + event.translationX,
              y: gesture.current.basePan.y + event.translationY,
            },
            gesture.current.scale,
            { width, height }
          );
          apply();
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zoomed, width, height]
  );

  const simultaneous = useMemo(() => Gesture.Simultaneous(pinch, pan), [pinch, pan]);

  return (
    <GestureDetector gesture={simultaneous}>
      <View style={{ width, height }}>
        {/* Letterbox: a foto ocupa a página inteira, mas o conteúdo é
            'contain' (inteiro, centrado) e o fundo da página é preto — as
            barras pretas são o fundo visível nas bordas não cobertas. */}
        <AnimalPhotoView
          photo={page.photo}
          uri={page.uri}
          testID={testID}
          resizeMode="contain"
          style={{
            width,
            height,
            borderRadius: 0,
            backgroundColor: 'transparent',
            transform: [
              { translateX: zoom.pan.x / zoom.scale },
              { translateY: zoom.pan.y / zoom.scale },
              { scale: zoom.scale },
            ],
          }}
        />
      </View>
    </GestureDetector>
  );
};

/**
 * RF09 + decisão 16: visualizador de fotos do anúncio em TELA CHEIA com
 * zoom por pinça (1x–4x — gestos nativos) e deslizar entre as fotos. Fundo
 * preto (letterbox), indicação "n/total" e fechar com ✕ (ou botão de voltar
 * no Android, via `onRequestClose`). Sem texto técnico (UI-09); funciona
 * offline — as fotos reutilizam `AnimalPhotoView` (resolução local-primeiro,
 * RNF01/RNF02).
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
  const [zoomed, setZoomed] = useState(false);

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
      {/* O Modal cria uma nova hierarquia nativa — o GestureDetector precisa
          de um GestureHandlerRootView próprio dentro dele (documentação RNGH). */}
      <GestureHandlerRootView style={styles.backdrop}>
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

        {/* Paginação entre fotos fica desligada enquanto uma foto está
            ampliada (o arrasto 1-dedo regula o recorte da foto ampliada). */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
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
              resetToken={visible ? 1 : 0}
              onZoomChange={setZoomed}
              testID={`${testID}-photo-${index}`}
            />
          ))}
        </ScrollView>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    // Fundo PRETO sólido: o letterbox (barras da foto em outra proporção)
    // depende dele para parecer "cinema".
    backgroundColor: '#000000',
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
