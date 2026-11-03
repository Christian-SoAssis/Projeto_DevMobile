import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { AnimalPhoto } from '../../domain/entities/AnimalPhoto';

export interface AnimalPhotoViewProps {
  /** Foto do agregado (persistida ou só-remota). */
  photo?: AnimalPhoto | null;
  /** URI direta sobrepostas à foto — ex.: captura ainda não persistida no formulário. */
  uri?: string | null;
  /** `testID` da imagem; o placeholder recebe `${testID}-placeholder`. */
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Componente único de exibição de foto de anúncio (RF09, RNF01/RNF02).
 *
 * Regra de resolução: **arquivo local primeiro** (cache offline precisa
 * abrir sem rede), `remoteUrl` como fallback. `displayUrl` sozinho não
 * serve: ele prefere a URL remota, que pode estar inalcançável offline
 * mesmo quando o arquivo copiado existe no aparelho.
 *
 * Encadeia os fallbacks via `onError`:
 * 1. arquivo local (ou a `uri` direta passada pela tela);
 * 2. URL remota (cache local limpo / vazamento depois do reinício);
 * 3. placeholder 🐾 quando não há foto (ou as duas falharam).
 */
export const AnimalPhotoView: React.FC<AnimalPhotoViewProps> = ({ photo, uri, testID, style }) => {
  const remoteUrl = photo?.remoteUrl ?? null;
  // Prioridade: uri direta > arquivo local > URL remota.
  const primaryUri = uri ?? photo?.localPath ?? remoteUrl;
  const fallbackUri = remoteUrl && remoteUrl !== primaryUri ? remoteUrl : null;

  // URIs que o carregador não conseguiu exibir; zera quando as URIs mudam
  // (ex.: no formulário, trocar a foto capturada não herda a falha antiga).
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  useEffect(() => {
    setFailed({});
  }, [primaryUri, remoteUrl]);

  const displayUri =
    primaryUri && !failed[primaryUri]
      ? primaryUri
      : fallbackUri && !failed[fallbackUri]
        ? fallbackUri
        : null;

  if (!displayUri) {
    return (
      <View
        style={[styles.frame, styles.placeholder, style]}
        testID={testID ? `${testID}-placeholder` : undefined}
      >
        <Text style={styles.placeholderIcon}>🐾</Text>
        <Text style={styles.placeholderText}>Sem foto no anúncio</Text>
      </View>
    );
  }

  return (
    <View style={[styles.frame, style]}>
      <Image
        source={{ uri: displayUri }}
        style={styles.image}
        resizeMode="cover"
        testID={testID}
        onError={() => setFailed((prev) => ({ ...prev, [displayUri]: true }))}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#ececec',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 34,
    marginBottom: 6,
  },
  placeholderText: {
    fontSize: 13,
    color: '#8e8e93',
  },
});
