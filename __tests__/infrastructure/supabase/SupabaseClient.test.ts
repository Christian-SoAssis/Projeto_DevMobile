import { readSupabaseConfig, loadSupabaseClient, SupabaseConfig } from '../../../src/infrastructure/supabase/client';
import { isSupabaseModule, SupabaseClientLike } from '../../../src/infrastructure/supabase/types';
import { createFakeSupabaseModule } from '../../../test-support/SupabaseFake';

describe('supabase/client — config por env e modo honesto (§0.1)', () => {
  const VALID: SupabaseConfig = { url: 'https://proj.exemplo.supabase.co', anonKey: 'anon-key' };

  it('EXPO_PUBLIC_SUPABASE_URL/ANON_KEY presentes → config lida', () => {
    expect(
      readSupabaseConfig({
        EXPO_PUBLIC_SUPABASE_URL: VALID.url,
        EXPO_PUBLIC_SUPABASE_ANON_KEY: VALID.anonKey,
      })
    ).toEqual(VALID);
  });

  it('env incompleta → null (app segue 100% offline/SQLite)', () => {
    expect(readSupabaseConfig({})).toBeNull();
    expect(readSupabaseConfig({ EXPO_PUBLIC_SUPABASE_URL: VALID.url })).toBeNull();
  });

  it('url fora do formato http(s) → null, evita cliente inválido', () => {
    expect(
      readSupabaseConfig({
        EXPO_PUBLIC_SUPABASE_URL: 'proj.exemplo.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: VALID.anonKey,
      })
    ).toBeNull();
  });

  it('módulo + config válidos → createClient chamado uma vez com (url, anonKey)', () => {
    const fakeClient = {} as SupabaseClientLike;
    const module = createFakeSupabaseModule(fakeClient);

    const client = loadSupabaseClient({ supabaseModule: module, config: VALID });

    expect(client).toBe(fakeClient);
    expect(module.clients).toHaveLength(1);
  });

  it('sem config (env vazia) → null e createClient NUNCA é chamado', () => {
    const module = createFakeSupabaseModule({} as SupabaseClientLike);

    const client = loadSupabaseClient({ supabaseModule: module, config: null });

    expect(client).toBeNull();
    expect(module.clients).toHaveLength(0);
  });

  it('módulo forçado para null (sem SDK) → null mesmo com config', () => {
    const client = loadSupabaseClient({ supabaseModule: null, config: VALID });
    expect(client).toBeNull();
  });

  it('createClient explodindo → null (build do APK nunca depende do Supabase)', () => {
    const module = {
      createClient: () => {
        throw new Error('SDK pau');
      },
      clients: [],
    };

    expect(loadSupabaseClient({ supabaseModule: module as never, config: VALID })).toBeNull();
  });

  it('sem opções e sem env → tenta o SDK real e devolve null (modo honesto, sem rede no Jest)', () => {
    // Exercita o `require('@supabase/supabase-js')` real: o SDK está instalado,
    // mas sem EXPO_PUBLIC_* o app continua 100% offline/SQLite.
    expect(loadSupabaseClient({ env: {} })).toBeNull();
  });

  it('isSupabaseModule discrimina o módulo real de valores inválidos', () => {
    expect(isSupabaseModule({ createClient: () => null })).toBe(true);
    expect(isSupabaseModule(null)).toBe(false);
    expect(isSupabaseModule('supabase-js')).toBe(false);
    expect(isSupabaseModule({})).toBe(false);
  });
});
