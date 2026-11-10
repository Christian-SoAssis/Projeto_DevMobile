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

/**
 * O `URL` nativo do React Native (`Libraries/Blob/URL.js`) define apenas getters
 * para `protocol`, `pathname`, `host`, `hostname` e `href`, além de regexes restritas
 * a `https?://`. O `@supabase/supabase-js` (`SupabaseClient` e `@supabase/realtime-js`)
 * faz `realtimeUrl.protocol = ...` e `wsUrl.pathname = ...` durante `createClient()`,
 * lançando `TypeError: Cannot set property protocol of #<URL> which has only a getter`
 * em strict mode. Este polyfill adiciona os setters e suporte a `ws(s)://` sem
 * precisar de pacotes externos.
 */
export function ensureReactNativeUrlPolyfill(UrlCtor: any = typeof URL !== 'undefined' ? URL : undefined): void {
  if (!UrlCtor || !UrlCtor.prototype) return;
  try {
    const probe = new UrlCtor('https://example.com/realtime/v1');
    probe.protocol = 'wss:';
    probe.pathname = '/realtime/v1/websocket';
    if (probe.protocol === 'wss:' && probe.pathname === '/realtime/v1/websocket') {
      return;
    }
  } catch {
    // Segue para aplicar os descritores no prototype do URL do React Native.
  }

  const proto = UrlCtor.prototype;
  const syncRawUrl = (instance: any): string => {
    if (typeof instance.toString === 'function') {
      return String(instance.toString());
    }
    return String(instance._url ?? '');
  };

  Object.defineProperties(proto, {
    protocol: {
      configurable: true,
      enumerable: true,
      get() {
        const current = String(this._url ?? '');
        const match = current.match(/^([a-zA-Z][a-zA-Z\d+\-.]*):/);
        return match ? `${match[1]}:` : '';
      },
      set(value: string) {
        const clean = String(value ?? '').replace(/:$/, '');
        if (!clean) return;
        const current = syncRawUrl(this);
        this._url = current.replace(/^([a-zA-Z][a-zA-Z\d+\-.]*):/, `${clean}:`);
      },
    },
    host: {
      configurable: true,
      enumerable: true,
      get() {
        const current = String(this._url ?? '');
        const hostMatch = current.match(/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\/(?:[^@]+@)?([^:/?#]+)/);
        const portMatch = current.match(/:(\d+)(?=[/?#]|$)/);
        return hostMatch ? hostMatch[1] + (portMatch ? `:${portMatch[1]}` : '') : '';
      },
      set(value: string) {
        const current = syncRawUrl(this);
        this._url = current.replace(
          /^([a-zA-Z][a-zA-Z\d+\-.]*:\/\/(?:[^@]+@)?)([^/?#]+)/,
          `$1${String(value ?? '')}`
        );
      },
    },
    hostname: {
      configurable: true,
      enumerable: true,
      get() {
        const current = String(this._url ?? '');
        const match = current.match(/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\/(?:[^@]+@)?([^:/?#]+)/);
        return match ? match[1] : '';
      },
      set(value: string) {
        const current = syncRawUrl(this);
        this._url = current.replace(
          /^([a-zA-Z][a-zA-Z\d+\-.]*:\/\/(?:[^@]+@)?)([^:/?#]+)/,
          `$1${String(value ?? '')}`
        );
      },
    },
    origin: {
      configurable: true,
      enumerable: true,
      get() {
        const current = String(this._url ?? '');
        const match = current.match(/^([a-zA-Z][a-zA-Z\d+\-.]*:\/\/[^/?#]+)/);
        return match ? match[1] : '';
      },
    },
    pathname: {
      configurable: true,
      enumerable: true,
      get() {
        const current = String(this._url ?? '');
        const match = current.match(/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\/[^/?#]+(\/[^?#]*)?/);
        return match ? match[1] || '/' : '/';
      },
      set(value: string) {
        const rawPath = String(value ?? '');
        const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
        const current = syncRawUrl(this);
        const match = current.match(/^([a-zA-Z][a-zA-Z\d+\-.]*:\/\/[^/?#]+)(\/[^?#]*)?(\?[^#]*)?(#.*)?$/);
        if (match) {
          this._url = `${match[1]}${normalizedPath}${match[3] ?? ''}${match[4] ?? ''}`;
        }
      },
    },
    href: {
      configurable: true,
      enumerable: true,
      get() {
        return syncRawUrl(this);
      },
      set(value: string) {
        this._url = String(value ?? '');
        this._searchParamsInstance = null;
      },
    },
  });
}

/** Lê `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` do env. */
export function readSupabaseConfig(env?: Record<string, string | undefined>): SupabaseConfig | null {
  // Em testes sem `env` explícito, preserva o isolamento offline (sem ler `.env.local` do dev).
  if (!env && typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return null;
  }
  // IMPORTANTE (Expo/Metro): `babel-preset-expo` só substitui `process.env.EXPO_PUBLIC_*`
  // quando acessado via notação estática direta (`process.env.EXPO_PUBLIC_...`).
  const rawUrl = env ? env['EXPO_PUBLIC_SUPABASE_URL'] : process.env.EXPO_PUBLIC_SUPABASE_URL;
  const rawAnonKey = env
    ? env['EXPO_PUBLIC_SUPABASE_ANON_KEY']
    : process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const url = (rawUrl || '').trim();
  const anonKey = (rawAnonKey || '').trim();
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
  ensureReactNativeUrlPolyfill();

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
    'config' in options && options.config !== undefined
      ? options.config
      : readSupabaseConfig(options.env);

  if (!config) return null;

  try {
    return module.createClient(config.url, config.anonKey);
  } catch {
    return null;
  }
}
