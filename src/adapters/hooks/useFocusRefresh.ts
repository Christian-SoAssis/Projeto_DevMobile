import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { onPullCompleted } from '../sync/pullEvents';
export function useFocusRefresh(): number {
  const [pulse, setPulse] = useState(0);
  useFocusEffect(useCallback(() => {
    setPulse(p => p + 1);
    return onPullCompleted(() => setPulse(p => p + 1));
  }, []));
  return pulse;
}
