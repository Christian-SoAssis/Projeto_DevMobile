import { createClient as defaultCreateClient } from '@supabase/supabase-js';
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

/** Lê `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` do env com fallback seguro. */
export function readSupabaseConfig(env?: Record<string, string | undefined>): SupabaseConfig | null {
  // Em testes sem `env` explícito, preserva o isolamento offline (sem ler `.env.local` do dev).
  if (!env && typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return null;
  }
  // IMPORTANTE (Expo/Metro): se o bundler falhar em fazer o inline estático de process.env,
  // usamos as credenciais configuradas no .env.local como garantia de runtime.
  const rawUrl =
    (env ? env['EXPO_PUBLIC_SUPABASE_URL'] : undefined) ??
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    'https://rmsvprwmrwprmtlsqndo.supabase.co';

  const rawAnonKey =
    (env ? env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] : undefined) ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtc3Zwcndtcndwcm10bHNxbmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2MzM4NTcsImV4cCI6MjEwOTIwOTg1N30.kwwPbUhZuAWj01EK8tWt8HyVobf-8yTd7qIu0Vkr4x8';

  const url = (rawUrl || '').trim();
  const anonKey = (rawAnonKey || '').trim();
  if (!url || !anonKey) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[Supabase Config] Variáveis de ambiente ausentes:', {
        urlDefinida: Boolean(url),
        anonKeyDefinida: Boolean(anonKey),
      });
    }
    return null;
  }
  if (!/^https?:\/\//i.test(url)) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[Supabase Config] URL inválida (deve começar com http:// ou https://):', url);
    }
    return null;
  }
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
    if ('supabaseModule' in options && options.supabaseModule !== undefined) {
      module = options.supabaseModule;
    } else {
      try {
        if (typeof defaultCreateClient === 'function') {
          module = { createClient: defaultCreateClient };
        } else {
          const imported = require('@supabase/supabase-js');
          // SDK real sai por barrel: `createClient` fica direto ou em `.default`.
          module = isSupabaseModule(imported)
            ? imported
            : imported && isSupabaseModule(imported.default)
              ? imported.default
              : null;
        }
      } catch (importErr) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.warn('[Supabase SDK] Falha ao importar @supabase/supabase-js:', importErr);
        }
        module = null;
      }
    }
    if (!module) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[Supabase SDK] Módulo createClient não disponível.');
      }
      return null;
    }

    const config =
      'config' in options && options.config !== undefined
        ? options.config
        : readSupabaseConfig(options.env);

    if (!config) return null;

    try {
      const client = (module as any).createClient(config.url, config.anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[Supabase Client] Inicializado com sucesso para:', config.url);
      }
      return client;
    } catch (clientErr) {
      try {
        const client = module.createClient(config.url, config.anonKey);
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.log('[Supabase Client] Inicializado no modo básico para:', config.url);
        }
        return client;
      } catch (fallbackErr) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          console.error('[Supabase Client] Falha ao executar createClient:', clientErr, fallbackErr);
        }
        return null;
      }
    }
  }
