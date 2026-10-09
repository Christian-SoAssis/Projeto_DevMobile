import { SessionStorage } from '../../domain/ports/SessionStorage';

declare const require: any;

const SESSION_KEY = 'session_token';

interface SecureStoreModule {
  isAvailableAsync?: () => Promise<boolean>;
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
}

function loadSecureStore(): SecureStoreModule | null {
  try {
    if (typeof require === 'undefined' || typeof require !== 'function') return null;
    const mod = require('expo-secure-store') as SecureStoreModule;
    if (!mod || typeof mod.getItemAsync !== 'function') return null;
    return mod;
  } catch {
    return null;
  }
}

// Fase 2: liga ao `expo-secure-store` real (Keychain/Keystore) quando
// disponível; fora do dispositivo (ex.: Jest) cai no espelho em memória,
// preservando o contrato da Fase 1. Nenhum erro nativo vaza para a UI.
export class SessionStorageSecureStore implements SessionStorage {
  private inMemoryToken: string | null = null;
  private secureStore: SecureStoreModule | null | undefined;

  private async native(): Promise<SecureStoreModule | null> {
    if (this.secureStore === undefined) {
      this.secureStore = loadSecureStore();
    }
    const mod = this.secureStore;
    if (!mod) return null;
    try {
      if (typeof mod.isAvailableAsync === 'function' && !(await mod.isAvailableAsync())) {
        return null;
      }
      return mod;
    } catch {
      return null;
    }
  }

  async saveSessionToken(token: string): Promise<void> {
    this.inMemoryToken = token;
    const store = await this.native();
    if (!store) return;
    try {
      await store.setItemAsync(SESSION_KEY, token);
    } catch {
      // Fallback: espelho em memória já atualizado acima.
    }
  }

  async getSessionToken(): Promise<string | null> {
    const store = await this.native();
    if (store) {
      try {
        const value: unknown = await store.getItemAsync(SESSION_KEY);
        if (typeof value === 'string') {
          this.inMemoryToken = value;
          return value;
        }
      } catch {
        // Fallback para o espelho em memória abaixo.
      }
    }
    return this.inMemoryToken;
  }

  async clearSession(): Promise<void> {
    this.inMemoryToken = null;
    const store = await this.native();
    if (!store) return;
    try {
      await store.deleteItemAsync(SESSION_KEY);
    } catch {
      // Fallback: espelho em memória já limpo acima.
    }
  }
}
