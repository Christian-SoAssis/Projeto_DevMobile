/**
 * Contrato para armazenamento seguro de sessão (DAT-03, DAT-04).
 *
 * Implementações devem criptografar o token de sessão diretamente no dispositivo
 * (Keychain no iOS / Keystore no Android), evitando o uso de armazenamento não seguro.
 */
export interface SessionStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
