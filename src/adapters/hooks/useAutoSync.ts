import { useEffect } from 'react';
import { ConnectivityGateway } from '../../domain/ports/ConnectivityGateway';

export interface UseAutoSyncOptions {
  /** Só sincroniza com backend configurado e usuário autenticado. */
  enabled: boolean;
  gateway: ConnectivityGateway;
  /** Precisa ser estável (useCallback): trocar a função reinicia a assinatura. */
  run: () => Promise<unknown>;
}

/**
 * Sincronização automática (doc §14.1, RF20): dispara UMA vez por ciclo de
 * reconexão — na abertura, se já estiver online, e a cada transição
 * offline → online. Ficar online não repete; só voltar após cair.
 */
export function useAutoSync({ enabled, gateway, run }: UseAutoSyncOptions): void {
  useEffect(() => {
    if (!enabled) return;

    let active = true;
    let wasOnline = false;
    const trigger = () => {
      if (active) run().catch(() => undefined); // falhas ficam na fila, visíveis na tela Sync
    };

    gateway
      .isConnected()
      .then((online) => {
        if (!active) return;
        wasOnline = online;
        if (online) trigger();
      })
      .catch(() => undefined);

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
