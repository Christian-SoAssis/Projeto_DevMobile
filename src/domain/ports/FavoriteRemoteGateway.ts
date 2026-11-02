/**
 * Perna remota dos favoritos (tabela `favorites`, privada por usuário — §15.1).
 * Ambas as operações são idempotentes: repetir uma ação da fila não é erro.
 */
export interface FavoriteRemoteGateway {
  addRemote(userId: string, animalId: string): Promise<void>;
  removeRemote(userId: string, animalId: string): Promise<void>;
}
