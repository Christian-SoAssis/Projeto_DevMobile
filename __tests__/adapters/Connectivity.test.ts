import { NetInfoConnectivityAdapter } from '../../src/infrastructure/device/connectivity/NetInfoAdapter';
import { ConnectivityGateway } from '../../src/domain/ports/ConnectivityGateway';
import { useConnectivity } from '../../src/adapters/hooks/useConnectivity';
import { renderHook, act, waitFor } from '@testing-library/react-native';

interface FakeNetInfoModule {
  current: boolean | null;
  listeners: Array<(state: { isConnected: boolean | null }) => void>;
  fetch(): Promise<{ isConnected: boolean | null }>;
  addEventListener(listener: (state: { isConnected: boolean | null }) => void): () => void;
  emit(value: boolean | null): void;
}

function makeFakeNetInfo(initial: boolean | null = true): FakeNetInfoModule {
  const module = {
    current: initial,
    listeners: [] as Array<(state: { isConnected: boolean | null }) => void>,
    async fetch() {
      return { isConnected: module.current };
    },
    addEventListener(listener: (state: { isConnected: boolean | null }) => void) {
      module.listeners.push(listener);
      return () => {
        module.listeners = module.listeners.filter((l) => l !== listener);
      };
    },
    emit(value: boolean | null) {
      module.current = value;
      module.listeners.forEach((l) => l({ isConnected: value }));
    },
  };
  return module as unknown as FakeNetInfoModule;
}

describe('NetInfoConnectivityAdapter (Fase 2 — conectividade real)', () => {
  it('isConnected reflete o estado reportado pelo NetInfo', async () => {
    const netinfo = makeFakeNetInfo(false);
    const adapter = new NetInfoConnectivityAdapter({ netinfo });

    expect(await adapter.isConnected()).toBe(false);

    netinfo.emit(true);
    expect(await adapter.isConnected()).toBe(true);
  });

  it('subscribe propaga as mudanças de rede aos ouvintes', async () => {
    const netinfo = makeFakeNetInfo(true);
    const adapter = new NetInfoConnectivityAdapter({ netinfo });

    const received: boolean[] = [];
    const unsubscribe = adapter.subscribe((online) => received.push(online));

    netinfo.emit(false);
    netinfo.emit(true);

    expect(received).toEqual([false, true]);
    unsubscribe();
    netinfo.emit(false);
    expect(received).toEqual([false, true]); // desassinado: nada novo chega
  });

  it('estado desconhecido (null no iOS) é tratado como online, sem bloquear o app', async () => {
    const netinfo = makeFakeNetInfo(null);
    const adapter = new NetInfoConnectivityAdapter({ netinfo });

    expect(await adapter.isConnected()).toBe(true);
  });

  it('falha ao consultar o NetInfo (fetch lança) cai no estado assumido', async () => {
    const adapter = new NetInfoConnectivityAdapter({
      netinfo: {
        fetch: () => Promise.reject(new Error('netinfo fora do ar')),
        addEventListener: () => () => undefined,
      } as unknown as FakeNetInfoModule,
      assumeOnlineWhenUnavailable: false,
    });

    expect(await adapter.isConnected()).toBe(false);
  });

  it('sem módulo (netinfo: null explícito): assume online e subscribe retorna desassinatura no-op segura', async () => {
    // `netinfo: null` força o caminho "módulo indisponível" de forma
    // determinística, independentemente do pacote estar instalado.
    const adapter = new NetInfoConnectivityAdapter({ netinfo: null });

    expect(await adapter.isConnected()).toBe(true);
    expect(typeof adapter.subscribe(() => undefined)).toBe('function');
  });

  it('fallback configurável: assumeOffline quando o módulo não está disponível', async () => {
    const adapter = new NetInfoConnectivityAdapter({
      netinfo: null,
      assumeOnlineWhenUnavailable: false,
    });

    expect(await adapter.isConnected()).toBe(false);
  });

  it('construtor padrão degrada com segurança em qualquer ambiente (com ou sem pacote)', async () => {
    // Usa require dinâmico; em Jest sem o pacote instalado cai no fallback,
    // com o pacote instalado pode consultar o estado real — ambos devem
    // retornar um booleano sem lançar exceção.
    const adapter = new NetInfoConnectivityAdapter();
    const state = await adapter.isConnected();

    expect([true, false]).toContain(state);
  });
});

describe('useConnectivity (hook reativo)', () => {
  it('inicia online e reflete o estado inicial do adapter', async () => {
    const netinfo = makeFakeNetInfo(false);
    const adapter: ConnectivityGateway = new NetInfoConnectivityAdapter({ netinfo });

    const { result } = await renderHook(() => useConnectivity(adapter));

    await waitFor(() => expect(result.current).toBe(false));
  });

  it('atualiza quando o dispositivo recupera/perde a conexão', async () => {
    const netinfo = makeFakeNetInfo(true);
    const adapter: ConnectivityGateway = new NetInfoConnectivityAdapter({ netinfo });

    const { result } = await renderHook(() => useConnectivity(adapter));
    await waitFor(() => expect(result.current).toBe(true));

    await act(() => netinfo.emit(false));
    expect(result.current).toBe(false);

    await act(() => netinfo.emit(true));
    expect(result.current).toBe(true);
  });

  it('consulta inicial que lança erro: hook mantém online sem quebrar', async () => {
    const broken: ConnectivityGateway = {
      isConnected: () => Promise.reject(new Error('queda de rede na consulta')),
      subscribe: () => () => undefined,
    };

    const { result } = await renderHook(() => useConnectivity(broken));
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toBe(true);
  });
});
