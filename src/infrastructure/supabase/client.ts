import { SupabaseClientLike, SupabaseConfig, SupabaseModuleLike } from './types';
import { SessionStorageSecureStore } from '../../adapters/auth/SessionStorageSecureStore';

export interface LoadSupabaseClientOptions {
  config?: SupabaseConfig | null;
  supabaseModule?: SupabaseModuleLike | null;
}

/**
 * Armazenamento de sessão seguro com suporte a sessões > 2 KB (DAT-03, DAT-04, SUP-02).
 */
const sessionStorage = new SessionStorageSecureStore();

let singletonClient: SupabaseClientLike | null = null;

/**
 * Lê as variáveis públicas de ambiente `EXPO_PUBLIC_SUPABASE_URL` e
 * `EXPO_PUBLIC_SUPABASE_ANON_KEY` (ou `EXPO_PUBLIC_SUPABASE_KEY`).
 * Retorna `null` se qualquer uma estiver ausente (sem valores hardcoded no código).
 */
export function readSupabaseConfigFromEnv(): SupabaseConfig | null {
  const url =
    typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_SUPABASE_URL : undefined;
  const anonKey =
    typeof process !== 'undefined'
      ? process.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env?.EXPO_PUBLIC_SUPABASE_KEY
      : undefined;

  if (!url?.trim() || !anonKey?.trim()) return null;
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
