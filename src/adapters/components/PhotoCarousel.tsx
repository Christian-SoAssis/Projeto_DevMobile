import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { AnimalPhoto } from '../../domain/entities/AnimalPhoto';
import { AnimalPhotoView } from './AnimalPhotoView';

export interface PhotoPage {
  /** Foto do agregado (persistida ou só-remota). */
  photo?: AnimalPhoto | null;
  /** URI direta sobreposta à foto — ex.: captura ainda não persistida no formulário. */
  uri?: string | null;
  /** `testID` da página; quem decide é a tela, para preservar os contratos de teste. */
  testID?: string;
  /** Toque na página — ex.: abrir o visualizador com zoom (decisão 16). */
  onPress?: () => void;
  /** Controles anexados à página — ex.: ◀/▶/remover por foto no formulário. */
  footer?: React.ReactNode;
}

export interface PhotoCarouselProps {
  pages: PhotoPage[];
  /** Altura fixa da página (mesma regra do `AnimalPhotoView`: 180 por padrão). */
  height?: number;
  /** Controle externo: rola para a posição quando muda (opcional). */
  activeIndex?: number;
  onPageChange?: (index: number) => void;
  /** Base dos testIDs do indicador: `${testID}-position` e `${testID}-dot-N`. */
  testID?: string;
}

/**
 * RF09 + decisão 16: carrossel das fotos do anúncio — **≥ 2 fotos** ficam
 * todas visíveis, navegáveis foto a foto (deslizar + pontos de posição);
 * com **1 foto** o indicador desaparece (foto simples). Componente
 * controlável (`activeIndex`/`onPageChange`) mas independente: sem estado
 * interno obrigatório. Sem dependência nova — `ScrollView` horizontal
 * paginado; cada página reutiliza `AnimalPhotoView` (resolução
 * local-primeiro, RNF01/RNF02, offline).
 */
export const PhotoCarousel: React.FC<PhotoCarouselProps> = ({
  pages,
  height = 180,
  activeIndex,
  onPageChange,
  testID,
}) => {
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const lastPage = useRef(0);
  const [pageWidth, setPageWidth] = useState(Dimensions.get('window').width);
  const [position, setPosition] = useState(0);

  // A lista encolheu (remoção no formulário): recua para a última página válida.
  useEffect(() => {
    const last = Math.max(0, pages.length - 1);
    setPosition((prev) => (prev > last ? last : prev));
  }, [pages.length]);

  // Controle externo: a tela hospedeira pede uma posição.
  useEffect(() => {
    if (activeIndex === undefined) return;
    lastPage.current = activeIndex;
    setPosition((prev) => (prev === activeIndex ? prev : activeIndex));
    scrollRef.current?.scrollTo({ x: activeIndex * pageWidth, animated: false });
  }, [activeIndex, pageWidth]);

  const handleMeasure = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    if (width > 0 && width !== pageWidth) setPageWidth(width);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = event.nativeEvent.contentOffset.x;
    if (pageWidth <= 0) return;
    const target = Math.min(Math.max(Math.round(offset / pageWidth), 0), Math.max(0, pages.length - 1));
    if (lastPage.current === target) return;
    lastPage.current = target;
    setPosition(target);
    onPageChange?.(target);
  };

  const goTo = (index: number) => {
    // Posição otimista: a UI reage na hora; o evento de scroll converge
    // para o mesmo alvo quando o gesto termina (comportamento de carrossel).
    lastPage.current = index;
    setPosition(index);
    onPageChange?.(index);
    scrollRef.current?.scrollTo({ x: index * pageWidth, animated: true });
  };

  if (pages.length === 0) return null;

  const isOnSinglePhoto = pages.length === 1;
  const photoStyle = [styles.photo, { height }];

  return (
    <View style={styles.container} testID={testID} onLayout={handleMeasure}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        testID={testID ? `${testID}-scroll` : undefined}
      >
        {pages.map((page, index) => {
          const photo = (
            <AnimalPhotoView
              photo={page.photo}
              uri={page.uri}
              testID={page.testID}
              style={photoStyle}
            />
          );
          return (
            <View key={index} style={[styles.page, { width: pageWidth, height }]}>
              {page.onPress ? (
                <TouchableOpacity
                  style={styles.photoTap}
                  activeOpacity={0.9}
                  onPress={page.onPress}
                  testID={page.testID ? `${page.testID}-tap` : undefined}
                  accessibilityLabel={isOnSinglePhoto ? 'Abrir foto em tela cheia' : `Abrir foto ${index + 1} em tela cheia`}
                >
                  {photo}
                </TouchableOpacity>
              ) : (
                photo
              )}
              {page.footer}
            </View>
          );
        })}
      </ScrollView>

      {!isOnSinglePhoto && (
        <View style={styles.indicator} testID={testID ? `${testID}-indicator` : undefined}>
          {pages.map((_, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.dot, index === position && styles.dotActive]}
              onPress={() => goTo(index)}
              testID={testID ? `${testID}-dot-${index}` : undefined}
              accessibilityLabel={`Ir para a foto ${index + 1}`}
            />
          ))}
          <Text style={styles.position} testID={testID ? `${testID}-position` : undefined}>
            {position + 1}/{pages.length}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#ececec',
  },
  page: {
    height: 180,
  },
  photo: {
    borderRadius: 0,
  },
  photoTap: {
    width: '100%',
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  dotActive: {
    backgroundColor: '#1c1c1e',
  },
  position: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1c1c1e',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
});
