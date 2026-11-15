import { SupabaseClientLike, SupabaseConfig, SupabaseModuleLike } from './types';

export interface LoadSupabaseClientOptions {
  config?: SupabaseConfig | null;
  supabaseModule?: SupabaseModuleLike | null;
}

/**
 * Armazenamento de sessão em `expo-secure-store` com fallback seguro em memória.
 */
function createSessionStorage() {
  const memoryStore = new Map<string, string>();
  let secureStore: any = null;
  const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

  if (!isTestEnv) {
    try {
      secureStore = require('expo-secure-store');
    } catch {
      secureStore = null;
    }
  }

  return {
    async getItem(key: string): Promise<string | null> {
      const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, '_');
      if (secureStore && typeof secureStore.getItemAsync === 'function') {
        try {
          const val = await secureStore.getItemAsync(safeKey);
          if (val !== null && val !== undefined) return val;
        } catch {
          // fallback para memória
        }
      }
      return memoryStore.get(safeKey) ?? null;
    },
    async setItem(key: string, value: string): Promise<void> {
      const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, '_');
      memoryStore.set(safeKey, value);
      if (secureStore && typeof secureStore.setItemAsync === 'function') {
        try {
          await secureStore.setItemAsync(safeKey, value);
        } catch {
          // fallback em memória já salvo
        }
      }
    },
    async removeItem(key: string): Promise<void> {
      const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, '_');
      memoryStore.delete(safeKey);
      if (secureStore && typeof secureStore.deleteItemAsync === 'function') {
        try {
          await secureStore.deleteItemAsync(safeKey);
        } catch {
          // ignora
        }
      }
    },
  };
}

let singletonClient: SupabaseClientLike | null = null;

export function readSupabaseConfigFromEnv(): SupabaseConfig | null {
  const url =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_URL) ||
    'https://rmsvprwmrwprmtlsqndo.supabase.co';
  const anonKey =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY) ||
    'sb_publishable_KWYaB7uP_Myg2FXxgPhDuA_mEnxW9Sr';

  if (!url || !anonKey) return null;
  return { url: url.trim(), anonKey: anonKey.trim() };
}

/**
 * Instancia o cliente Supabase real (DAT-03, DAT-04).
 */
export function loadSupabaseClient(
  options: LoadSupabaseClientOptions = {}
): SupabaseClientLike | null {
  if (options.config === null || options.supabaseModule === null) {
    return null;
  }

  const config = options.config !== undefined ? options.config : readSupabaseConfigFromEnv();
  if (!config || !config.url || !config.anonKey) {
    return null;
  }

  if (!options.config && !options.supabaseModule && singletonClient) {
    return singletonClient;
  }

  let mod: SupabaseModuleLike | null = null;
  if (options.supabaseModule !== undefined) {
    mod = options.supabaseModule;
  } else {
    try {
      try {
        require('react-native-url-polyfill/auto');
      } catch {
        // polyfill opcional
      }
      mod = require('@supabase/supabase-js');
    } catch {
      mod = null;
    }
  }

  if (!mod || typeof mod.createClient !== 'function') {
    return null;
  }

  const client = mod.createClient(config.url, config.anonKey, {
    auth: {
      storage: createSessionStorage(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  if (!options.config && !options.supabaseModule) {
    singletonClient = client;
  }

  return client;
}
