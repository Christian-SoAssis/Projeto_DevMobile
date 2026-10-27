/**
 * Port de conectividade de rede.
 *
 * Permite que casos de uso e hooks saibam se há internet (RF17–RF22, RNF02)
 * sem conhecer `@react-native-community/netinfo` ou qualquer SDK de rede:
 * a implementação concreta vive em `src/infrastructure/device/` (doc §13).
 *
 * Regra (§0 item 2): o domínio nunca importa SDKs — aqui só existe o contrato.
 */
export type ConnectivityListener = (isOnline: boolean) => void;

export interface ConnectivityGateway {
  /**
   * Estado atual da rede. Retorna `true` quando o estado é desconhecido
   * (não deve bloquear o app — o fallback offline é responsabilidade dos
   * casos de uso, doc §15.2).
   */
  isConnected(): Promise<boolean>;
  /** Assina mudanças de conectividade. Retorna a função de desassinatura. */
  subscribe(listener: ConnectivityListener): () => void;
}
