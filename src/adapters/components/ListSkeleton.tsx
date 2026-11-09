import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

/**
 * Skeleton de listagem (melhoria #9): linhas cinza com pulso suave durante o
 * carregamento — percepção de velocidade (conteúdo "a caminho") em vez do
 * spinner núcleo-dinamite antigo. Componente puro de apresentação: não carrega
 * dado, não conhece repositório.
 */
export const ListSkeleton: React.FC<{ rows?: number; testID?: string }> = ({
  rows = 3,
  testID = 'list-skeleton',
}) => {
  // Pulso de opacidade (0.4 ↔ 1.0). `useRef` evita recriar o valor animado
  // a cada render; loop é interrompido na desmontagem.
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View testID={testID}>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.card} testID={`${testID}-row-${index + 1}`}>
          <Animated.View style={[styles.titleBar, { opacity: pulse }]} />
          <Animated.View style={[styles.lineBar, { opacity: pulse }]} />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderColor: '#e5e5ea',
    borderWidth: 1,
  },
  titleBar: {
    height: 18,
    width: '45%',
    borderRadius: 4,
    backgroundColor: '#e5e5ea',
  },
  lineBar: {
    height: 12,
    width: '80%',
    borderRadius: 4,
    backgroundColor: '#e5e5ea',
    marginTop: 10,
  },
});
