import { SessionStorage } from '../../domain/ports/SessionStorage';

export interface SecureStoreModuleLike {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

/**
 * Tamanho máximo por bloco no SecureStore (o limite nativo do Keychain/Keystore é ~2.048 bytes).
 * Usamos 1.800 caracteres para garantir margem segura mesmo com caracteres multi-byte.
 */
const CHUNK_SIZE = 1800;
const CHUNK_PREFIX = '__chunked__:';

/**
 * Adaptador de sessão segura encapsulando `expo-secure-store` com fragmentação automática
 * (padrão LargeSecureStore / ChunkedSecureStore — SUP-02, SUP-07, DAT-03, DAT-04).
 *
 * Como a sessão JWT completa do Supabase frequentemente ultrapassa o limite de ~2 KB
 * do `expo-secure-store`, valores maiores que `1.800` bytes são divididos em blocos
 * (`<key>__chunk_0`, `<key>__chunk_1`, ...) criptografados individualmente no Keychain/Keystore,
 * evitando queda silenciosa para a memória RAM e perda de login ao fechar o aplicativo.
 */
export class SessionStorageSecureStore implements SessionStorage {
  private memoryStore = new Map<string, string>();
  private secureStore: SecureStoreModuleLike | null = null;

  constructor(secureStoreModule?: SecureStoreModuleLike | null) {
    if (secureStoreModule !== undefined) {
      this.secureStore = secureStoreModule;
    } else {
      this.initializeSecureStore();
    }
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

  private chunkKey(baseKey: string, index: number): string {
    return `${baseKey}__chunk_${index}`;
  }

  async getItem(key: string): Promise<string | null> {
    const safeKey = this.safeKey(key);

    if (this.secureStore && typeof this.secureStore.getItemAsync === 'function') {
      try {
        const headerOrValue = await this.secureStore.getItemAsync(safeKey);
        if (headerOrValue !== null && headerOrValue !== undefined) {
          if (!headerOrValue.startsWith(CHUNK_PREFIX)) {
            this.memoryStore.set(safeKey, headerOrValue);
            return headerOrValue;
          }

          const count = Number(headerOrValue.slice(CHUNK_PREFIX.length));
          if (Number.isInteger(count) && count > 0) {
            const parts: string[] = [];
            for (let i = 0; i < count; i++) {
              const part = await this.secureStore.getItemAsync(this.chunkKey(safeKey, i));
              if (part === null || part === undefined) {
                return this.memoryStore.get(safeKey) ?? null;
              }
              parts.push(part);
            }
            const fullValue = parts.join('');
            this.memoryStore.set(safeKey, fullValue);
            return fullValue;
          }
        }
      } catch {
        // fallback para memória se o SecureStore nativo falhar
      }
    }

    return this.memoryStore.get(safeKey) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    const safeKey = this.safeKey(key);
    this.memoryStore.set(safeKey, value);

    if (this.secureStore && typeof this.secureStore.setItemAsync === 'function') {
      try {
        await this.clearChunksInSecureStore(safeKey);

        if (value.length <= CHUNK_SIZE) {
          await this.secureStore.setItemAsync(safeKey, value);
          return;
        }

        const chunks: string[] = [];
        for (let offset = 0; offset < value.length; offset += CHUNK_SIZE) {
          chunks.push(value.slice(offset, offset + CHUNK_SIZE));
        }

        for (let i = 0; i < chunks.length; i++) {
          await this.secureStore.setItemAsync(this.chunkKey(safeKey, i), chunks[i]);
        }
        await this.secureStore.setItemAsync(safeKey, `${CHUNK_PREFIX}${chunks.length}`);
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
        await this.clearChunksInSecureStore(safeKey);
        await this.secureStore.deleteItemAsync(safeKey);
      } catch {
        // ignora
      }
    }
  }

  private async clearChunksInSecureStore(safeKey: string): Promise<void> {
    if (!this.secureStore) return;
    try {
      const existingHeader = await this.secureStore.getItemAsync(safeKey);
      if (existingHeader && existingHeader.startsWith(CHUNK_PREFIX)) {
        const count = Number(existingHeader.slice(CHUNK_PREFIX.length));
        if (Number.isInteger(count) && count > 0) {
          for (let i = 0; i < count; i++) {
            await this.secureStore.deleteItemAsync(this.chunkKey(safeKey, i));
          }
        }
      }
    } catch {
      // ignora erro ao limpar chunks antigos
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
