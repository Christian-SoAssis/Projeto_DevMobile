import { ConnectivityGateway, ConnectivityListener } from '../../../domain/ports/ConnectivityGateway';

/**
 * Forma mínima do módulo `@react-native-community/netinfo` usada aqui.
 * O módulo é carregado dinamicamente (não em import estático) para que o
 * projeto compile e os testes rodem mesmo sem o pacote instalado.
 */
interface NetInfoState {
  isConnected: boolean | null;
}

interface NetInfoModule {
  fetch(): Promise<NetInfoState>;
  addEventListener(listener: (state: NetInfoState) => void): () => void;
}

interface NetInfoAdapterOptions {
  /** Módulo injetado (testes). `null` força explicitamente o caminho "sem módulo". */
  netinfo?: NetInfoModule | null;
  /** Estado assumido quando o módulo não está disponível (padrão: online). */
  assumeOnlineWhenUnavailable?: boolean;
}

/**
 * Adapter de conectividade real do dispositivo (RNF02/RNF17, doc §16.3
 * Dispositivo: "reconexão dispara sincronização uma única vez por ciclo").
 *
 * Quando o módulo NetInfo não está disponível (unit tests/demo), o adapter
 * assume o estado configurado em `assumeOnlineWhenUnavailable` (default:
 * online) e não assina nada — degradação seguro, sem perda silenciosa.
 */
export class NetInfoConnectivityAdapter implements ConnectivityGateway {
  private netinfo: NetInfoModule | null;
  private assumeOnlineWhenUnavailable: boolean;

  constructor(options: NetInfoAdapterOptions = {}) {
    this.assumeOnlineWhenUnavailable = options.assumeOnlineWhenUnavailable ?? true;

    if ('netinfo' in options) {
      // Injeção explícita (testes): `null` força o caminho "sem módulo",
      // independentemente de o pacote estar instalado no node_modules.
      this.netinfo = options.netinfo || null;
    } else {
      try {
        // require dinâmico: o pacote pode estar ausente em Jest/demo.
        this.netinfo = require('@react-native-community/netinfo');
      } catch {
        this.netinfo = null;
      }
    }
  }

  async isConnected(): Promise<boolean> {
    if (!this.netinfo) {
      return this.assumeOnlineWhenUnavailable;
    }
    try {
      const state = await this.netinfo.fetch();
      return this.normalize(state);
    } catch {
      return this.assumeOnlineWhenUnavailable;
    }
  }

  subscribe(listener: ConnectivityListener): () => void {
    if (!this.netinfo) {
      return () => undefined;
    }
    return this.netinfo.addEventListener((state) => {
      listener(this.normalize(state));
    });
  }

  /**
   * NetInfo pode retornar `null` em iOS quando o estado é desconhecido.
   * Nesse caso assume online para não bloquear o app (RNF05/§15.2).
   */
  private normalize(state: NetInfoState): boolean {
    if (state.isConnected === null || state.isConnected === undefined) {
      return true;
    }
    return state.isConnected;
  }
}
