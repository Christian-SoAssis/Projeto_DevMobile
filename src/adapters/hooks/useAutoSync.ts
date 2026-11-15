import { useEffect } from 'react';
import { ConnectivityGateway } from '../../domain/ports/ConnectivityGateway';

export interface UseAutoSyncOptions {
  enabled: boolean;
  gateway: ConnectivityGateway;
  run: () => Promise<unknown>;
}

/**
 * Sincronização automática (RF20, §14.1): dispara na abertura se online e a cada
 * transição offline -> online.
 */
export function useAutoSync({ enabled, gateway, run }: UseAutoSyncOptions): void {
  useEffect(() => {
    if (!enabled) return;

    let active = true;
    let wasOnline = false;
    const trigger = () => {
      if (active) run().catch(() => undefined);
    };

    gateway
      .isConnected()
      .then((online) => {
        if (!active) return;
        wasOnline = online;
        if (online) trigger();
      })
      .catch(() => {
        if (active) trigger();
      });

    const unsubscribe = gateway.subscribe((online) => {
      if (online && !wasOnline) trigger();
      wasOnline = online;
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [enabled, gateway, run]);
}
