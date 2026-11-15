import { useEffect, useState } from 'react';
import { ConnectivityGateway } from '../../domain/ports/ConnectivityGateway';
import { NetInfoConnectivityAdapter } from '../../infrastructure/device/connectivity/NetInfoAdapter';

export function useConnectivity(adapter?: ConnectivityGateway): boolean {
  const [gateway] = useState<ConnectivityGateway>(() => adapter || new NetInfoConnectivityAdapter());
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    let active = true;

    gateway
      .isConnected()
      .then((initial) => {
        if (active) setIsOnline(initial);
      })
      .catch(() => undefined);

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
