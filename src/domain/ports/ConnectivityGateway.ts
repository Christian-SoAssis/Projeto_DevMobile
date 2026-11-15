export type ConnectivityListener = (isOnline: boolean) => void;

export interface ConnectivityGateway {
  isConnected(): Promise<boolean>;
  subscribe(listener: ConnectivityListener): () => void;
}
