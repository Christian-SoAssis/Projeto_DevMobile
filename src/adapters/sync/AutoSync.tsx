import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRepositories } from '../context/RepositoriesContext';
import { useAutoSync } from '../hooks/useAutoSync';
import { useFullSync } from '../hooks/useFullSync';
import { ConnectivityGateway } from '../../domain/ports/ConnectivityGateway';
import { NetInfoConnectivityAdapter } from '../../infrastructure/device/connectivity/NetInfoAdapter';

export interface AutoSyncProps {
  gateway?: ConnectivityGateway;
}

export function AutoSync({ gateway }: AutoSyncProps) {
  const { remoteMode } = useRepositories();
  const { user } = useAuth();
  const sync = useFullSync();
  const [connectivity] = useState<ConnectivityGateway>(
    () => gateway ?? new NetInfoConnectivityAdapter()
  );

  useAutoSync({ enabled: remoteMode === 'supabase', gateway: connectivity, run: sync });

  useEffect(() => {
    if (remoteMode !== 'supabase') return;
    sync().catch(() => undefined);
  }, [remoteMode, user?.id, sync]);

  return null;
}
