import { useEffect, useState } from 'react';
import { ConnectivityGateway } from '../../domain/ports/ConnectivityGateway';
import { NetInfoConnectivityAdapter } from '../../infrastructure/device/connectivity/NetInfoAdapter';

/**
 * Estado de rede reativo para as telas (RNF02/RF22).
 *
 * Injeta-se um `ConnectivityGateway` (testes) ou usa o adapter NetInfo real.
 * Enquanto o estado inicial é consultado, assume-se **online** para não
 * retardar a primeira busca — o fallback offline é responsabilidade dos
 * casos de uso (doc §15.2).
 */
export function useConnectivity(adapter?: ConnectivityGateway): boolean {
  const [gateway] = useState<ConnectivityGateway>(() => adapter || new NetInfoConnectivityAdapter());
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    let active = true;

    async function readInitial() {
      try {
        const initial = await gateway.isConnected();
        if (active) setIsOnline(initial);
      } catch {
        // Estado desconhecido: mantém online (fallback nos casos de uso).
      }
    }
    readInitial();

    const unsubscribe = gateway.subscribe((online) => {
      if (active) setIsOnline(online);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [gateway]);

  return isOnline;
}
