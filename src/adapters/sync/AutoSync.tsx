import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRepositories } from '../context/RepositoriesContext';
import { useAutoSync } from '../hooks/useAutoSync';
import { useFullSync } from '../hooks/useFullSync';
import { ConnectivityGateway } from '../../domain/ports/ConnectivityGateway';
import { NetInfoConnectivityAdapter } from '../../infrastructure/device/connectivity/NetInfoAdapter';

export interface AutoSyncProps {
  /** Injetável para testes. Padrão: NetInfo real. */
  gateway?: ConnectivityGateway;
}

/**
 * Montado uma vez na raiz do app: liga o `useAutoSync` quando há backend
 * configurado (mesmo visitante recebe o pull dos anúncios públicos) e
 * dispara um ciclo adicional sempre que a conta logada muda.
 */
export function AutoSync({ gateway }: AutoSyncProps) {
  const { remoteMode } = useRepositories();
  const { user } = useAuth();
  const sync = useFullSync();
  const [connectivity] = useState<ConnectivityGateway>(() => gateway ?? new NetInfoConnectivityAdapter());

  useAutoSync({ enabled: remoteMode === 'supabase', gateway: connectivity, run: sync });

  useEffect(() => {
    if (remoteMode !== 'supabase' || !user?.id) return;
    sync().catch(() => undefined);
  }, [remoteMode, user?.id, sync]);

  return null;
}
