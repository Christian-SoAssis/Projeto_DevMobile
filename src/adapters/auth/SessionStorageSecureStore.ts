import { SessionStorage } from '../../domain/ports/SessionStorage';

/**
 * Adaptador de sessão segura encapsulando `expo-secure-store` com fallback em memória.
 *
 * Criptografa o token de sessão diretamente no dispositivo (Keychain no iOS /
 * Keystore no Android), evitando o uso de armazenamento não seguro (DAT-03, DAT-04).
 *
 * Em ambiente de teste ou quando `expo-secure-store` não está disponível, recorre a
 * um Map em memória, permitindo execução de testes unitários sem dependência nativa.
 */
export class SessionStorageSecureStore implements SessionStorage {
  private memoryStore = new Map<string, string>();
  private secureStore: any = null;

  constructor() {
    this.initializeSecureStore();
  }

  private initializeSecureStore(): void {
    const isTestEnv =
      typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

    if (!isTestEnv) {
      try {
        this.secureStore = require('expo-secure-store');
      } catch {
        this.secureStore = null;
      }
    }
  }

  private safeKey(key: string): string {
    return key.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  async getItem(key: string): Promise<string | null> {
    const safeKey = this.safeKey(key);

    if (this.secureStore && typeof this.secureStore.getItemAsync === 'function') {
      try {
        const val = await this.secureStore.getItemAsync(safeKey);
        if (val !== null && val !== undefined) return val;
      } catch {
        // fallback para memória
      }
    }
    return this.memoryStore.get(safeKey) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    const safeKey = this.safeKey(key);
    this.memoryStore.set(safeKey, value);

    if (this.secureStore && typeof this.secureStore.setItemAsync === 'function') {
      try {
        await this.secureStore.setItemAsync(safeKey, value);
      } catch {
        // fallback em memória já salvo
      }
    }
  }

  async removeItem(key: string): Promise<void> {
    const safeKey = this.safeKey(key);
    this.memoryStore.delete(safeKey);

    if (this.secureStore && typeof this.secureStore.deleteItemAsync === 'function') {
      try {
        await this.secureStore.deleteItemAsync(safeKey);
      } catch {
        // ignora
      }
    }
  }

  // ============================================================================
  // Métodos auxiliares para testes
  // ============================================================================

  get size(): number {
    return this.memoryStore.size;
  }

  clear(): void {
    this.memoryStore.clear();
  }

  has(key: string): boolean {
    return this.memoryStore.has(this.safeKey(key));
  }

  getRaw(key: string): string | undefined {
    return this.memoryStore.get(this.safeKey(key));
  }
}
