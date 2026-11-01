import { SessionStorage } from '../../domain/ports/SessionStorage';

/**
 * Forma mínima do módulo `expo-secure-store` usada aqui. É injetável nos
 * testes e carregada dinamicamente em runtime (não em import estático), para
 * que o projeto compile e os testes rodem mesmo sem ponte nativa.
 */
interface SecureStoreModule {
  setItemAsync(key: string, value: string): Promise<void>;
  getItemAsync(key: string): Promise<string | null>;
  deleteItemAsync(key: string): Promise<void>;
}

export const SESSION_TOKEN_KEY = 'enlace_session_token';

export interface SessionStorageSecureStoreOptions {
  /** Módulo injetado (testes). `null` força explicitamente o fallback em memória. */
  secureStore?: SecureStoreModule | null;
}

export class SessionStorageSecureStore implements SessionStorage {
  private secureStore: SecureStoreModule | null;
  private inMemoryToken: string | null = null;
  /** Indica se houve leitura bem-sucedida do store real nesta instância. */
  private hydrated: boolean = false;

  constructor(options: SessionStorageSecureStoreOptions = {}) {
    if ('secureStore' in options) {
      this.secureStore = options.secureStore || null;
    } else {
      try {
        // require dinâmico: em Jest/demo a ponte nativa não existe e cai no
        // fallback em memória (mesma degradação do NetInfoAdapter).
        this.secureStore = require('expo-secure-store');
      } catch {
        this.secureStore = null;
      }
    }
  }

  async saveSessionToken(token: string): Promise<void> {
    this.inMemoryToken = token;
    if (!this.secureStore) return;
    try {
      // Keychain (iOS) / Keystore (Android) via ExpoSecureStore — critério §3.
      await this.secureStore.setItemAsync(SESSION_TOKEN_KEY, token);
    } catch {
      // O app segue com o token no cache em memória; a queda do app por
      // falha de armazenamento seguro seria pior que a sessão efêmera.
    }
  }

  async getSessionToken(): Promise<string | null> {
    if (this.inMemoryToken !== null) {
      return this.inMemoryToken;
    }
    if (!this.secureStore || this.hydrated) {
      return null;
    }
    this.hydrated = true;
    try {
      const stored = await this.secureStore.getItemAsync(SESSION_TOKEN_KEY);
      if (stored !== null && stored !== undefined) {
        this.inMemoryToken = stored;
      }
      return this.inMemoryToken;
    } catch {
      return null;
    }
  }

  async clearSession(): Promise<void> {
    this.inMemoryToken = null;
    if (!this.secureStore) return;
    try {
      await this.secureStore.deleteItemAsync(SESSION_TOKEN_KEY);
    } catch {
      // Sessão de memória já encerrada; store persistente limpo quando possível.
    }
  }
}
