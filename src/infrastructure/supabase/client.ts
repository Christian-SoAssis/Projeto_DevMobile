import {
  SupabaseClientLike,
  SupabaseModuleLike,
  SupabaseConfig,
  isSupabaseModule,
} from './types';

export type { SupabaseConfig };

export interface SupabaseLoadOptions {
  /** Módulo injetado (testes). `null` força "sem SDK", mesmo instalado. */
  supabaseModule?: SupabaseModuleLike | null;
  /** Config explícita (testes). Padrão: `process.env.EXPO_PUBLIC_*`. */
  config?: SupabaseConfig | null;
  /** Fonte de env sobrescrita (testes). Padrão: `process.env`. */
  env?: Record<string, string | undefined>;
}

/** Lê `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` do env. */
export function readSupabaseConfig(env?: Record<string, string | undefined>): SupabaseConfig | null {
  const source = env ?? (typeof process !== 'undefined' ? process.env : undefined) ?? {};
  const url = (source['EXPO_PUBLIC_SUPABASE_URL'] || '').trim();
  const anonKey = (source['EXPO_PUBLIC_SUPABASE_ANON_KEY'] || '').trim();
  if (!url || !anonKey) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  return { url, anonKey };
}

/**
 * Carrega o cliente Supabase do app. Regra do modo honesto (§0.1 do
 * nextsteps): sem credenciais ou sem SDK, retorna `null` e o app segue
 * 100% offline/SQLite — nada aqui afeta o build do APK nem exige rede.
 */
export function loadSupabaseClient(options: SupabaseLoadOptions = {}): SupabaseClientLike | null {
  let module: SupabaseModuleLike | null = null;
  if ('supabaseModule' in options) {
    module = options.supabaseModule || null;
  } else {
    try {
      const imported = require('@supabase/supabase-js');
      // SDK real sai por barrel: `createClient` fica direto ou em `.default`.
      module = isSupabaseModule(imported)
        ? imported
        : imported && isSupabaseModule(imported.default)
          ? imported.default
          : null;
    } catch {
      module = null;
    }
  }
  if (!module) return null;

  const config =
    'config' in options
      ? options.config === undefined
        ? readSupabaseConfig(options.env ?? (typeof process !== 'undefined' ? process.env : undefined))
        : options.config
      : readSupabaseConfig(options.env ?? (typeof process !== 'undefined' ? process.env : undefined));

  if (!config) return null;

  try {
    return module.createClient(config.url, config.anonKey);
  } catch {
    return null;
  }
}
