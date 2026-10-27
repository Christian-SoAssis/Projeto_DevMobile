import React from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Tabs mantêm as telas montadas; usar a chave retornada como `key` remonta a
 * tela a cada foco, refletindo mudanças feitas em outras rotas (detalhes,
 * formulário, exclusão etc.).
 */
export function useFocusKey(): number {
  const [focusKey, setFocusKey] = React.useState(0);
  useFocusEffect(
    React.useCallback(() => {
      setFocusKey((k) => k + 1);
    }, [])
  );
  return focusKey;
}
