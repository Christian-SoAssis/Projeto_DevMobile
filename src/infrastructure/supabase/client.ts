import { SupabaseClientLike, SupabaseConfig, SupabaseModuleLike } from './types';
import { SessionStorageSecureStore } from '../../adapters/auth/SessionStorageSecureStore';

export interface LoadSupabaseClientOptions {
  config?: SupabaseConfig | null;
  supabaseModule?: SupabaseModuleLike | null;
}

/**
 * Armazenamento de sessão seguro (DAT-03, DAT-04).
 * Implementado por `SessionStorageSecureStore` (encapsula `expo-secure-store`
 * com fallback em memória para testes).
 */
const sessionStorage = new SessionStorageSecureStore();

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
      storage: sessionStorage,
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
