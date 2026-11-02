/**
 * Formas estruturais mínimas do SDK `@supabase/supabase-js` consumidas pelos
 * adapters deste projeto. Declaradas aqui (em vez de importar tipos do pacote
 * em cada arquivo) para testes com fakes injetáveis e para manter a superfície
 * usada explícita — nenhum `src/domain/` ou `src/application/` pode importar
 * qualquer coisa daqui (doc §13.1).
 *
 * - `PostgrestResult`: resposta padrão (dados + erro).
 * - Builders são *thenable*: a cadeia `from().update().eq(...)` é aguardada
 *   e resolve no resultado — igual à API real.
 */

export interface PostgrestErrorLike {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

export interface PostgrestResult<T> {
  data: T | null;
  error: PostgrestErrorLike | null;
}

export type AnimalRow = {
  id: string;
  owner_id: string;
  name: string;
  species: string;
  size: string;
  approximate_age: string;
  sex: string;
  description: string | null;
  health_notes: string | null;
  special_care: string | null;
  status: string;
  neighborhood: string;
  city: string;
  region: string;
  latitude: number;
  longitude: number;
  created_at: string;
  updated_at: string;
  version: number;
};

export interface AnimalPhotoRow {
  id: string;
  animal_id: string;
  remote_url: string | null;
  is_main: boolean;
  upload_status: string;
  created_at: string;
}

export interface FavoriteRow {
  user_id: string;
  animal_id: string;
  created_at?: string;
}

export interface AdoptionInterestRow {
  id: string;
  user_id: string;
  animal_id: string;
  message: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: string;
  created_at: string;
}

export interface UserRow {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  user_type?: string | null;
  bio?: string | null;
  interests?: string[] | null;
}

/** Cadeia fluente PostgREST: métodos de filtro retornam o próprio builder. */
export interface SupabaseFilter<TRow> extends PromiseLike<PostgrestResult<TRow[]>> {
  eq(column: string, value: unknown): this;
  neq(column: string, value: unknown): this;
  in(column: string, values: unknown[]): this;
  /** Limita/ordenadores usados só na leitura pública de cache remoto. */
  order(column: string, options?: { ascending?: boolean }): this;
  limit(count: number): this;
}

export interface SupabaseInsertBuilder<TRow> extends SupabaseFilter<TRow> {
  /** `insert(...).select()` devolve as linhas gravadas (PostgREST). */
  select(): SupabaseFilter<TRow>;
}

export interface SupabaseMutationBuilder<TRow> extends SupabaseFilter<TRow> {
  /** `update(...).select()` devolve as linhas alteradas (0 linhas = bloqueado). */
  select: () => SupabaseFilter<TRow>;
}

export interface SupabaseTable<TRow> {
  select(columns?: string): SupabaseFilter<TRow>;
  insert(values: Partial<TRow> | Array<Partial<TRow>>): SupabaseInsertBuilder<TRow>;
  update(values: Partial<TRow>): SupabaseMutationBuilder<TRow>;
  delete(): SupabaseFilter<TRow>;
}

/** Superfície de `client.auth` usada pelo gateway (e-mail/senha — decisão §4). */
export interface SupabaseAuthUser {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}

export interface SupabaseSession {
  access_token: string;
  user: SupabaseAuthUser;
}

export interface SupabaseAuthResponse {
  data: { session: SupabaseSession | null };
  error: { message: string } | null;
}

export interface SupabaseSignUpResponse {
  data: { user: SupabaseAuthUser | null; session: SupabaseSession | null };
  error: { message: string } | null;
}

export interface SupabaseUserFetchResponse {
  data: { user: SupabaseAuthUser | null };
  error: { message: string } | null;
}

export interface SupabaseAuthApi {
  signInWithPassword(credentials: {
    email: string;
    password: string;
  }): Promise<SupabaseAuthResponse>;
  /** `options.data` vira `user_metadata` e alimenta o trigger `handle_new_user`. */
  signUp(credentials: {
    email: string;
    password: string;
    options?: { data?: Record<string, unknown> };
  }): Promise<SupabaseSignUpResponse>;
  signOut(): Promise<{ error: { message: string } | null }>;
  getSession(): Promise<{ data: { session: SupabaseSession | null }; error: { message: string } | null }>;
  /** Usado para validar um access_token externo (`acessarViaToken`). */
  getUser(token?: string): Promise<SupabaseUserFetchResponse>;
}

/** `client.storage.from(bucket)`: só o que o `SupabasePhotoStorage` usa. */
export interface SupabaseStorageBucket {
  upload(
    path: string,
    body: ArrayBuffer | Uint8Array,
    options?: { contentType?: string; upsert?: boolean }
  ): Promise<{ data: { path: string } | null; error: { message: string } | null }>;
  remove(paths: string[]): Promise<{ error: { message: string } | null }>;
  getPublicUrl(path: string): { data: { publicUrl: string } };
}

export interface SupabaseStorageApi {
  from(bucket: string): SupabaseStorageBucket;
}

/** Cliente mínimo do SDK. */
export interface SupabaseClientLike {
  auth: SupabaseAuthApi;
  storage: SupabaseStorageApi;
  /** O parâmetro `TRow` dá tipografia do row por tabela usado pelo adapter. */
  from<TRow extends object = Record<string, unknown>>(table: string): SupabaseTable<TRow>;
}

/**
 * Forma do módulo injetável (testes) — apenas `createClient`.
 * O módulo real (`@supabase/supabase-js`) satisfaz estruturalmente.
 */
export interface SupabaseModuleLike {
  createClient(url: string, anonKey: string): SupabaseClientLike;
}

export function isSupabaseModule(value: unknown): value is SupabaseModuleLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { createClient?: unknown }).createClient === 'function'
  );
}

/**
 * Credenciais do Supabase (doc §14.2/§15). Em Expo, as variáveis públicas
 * são injetadas no bundle via `EXPO_PUBLIC_*`:
 *
 *   EXPO_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
 *
 * A `anon key` é pública por desenho — a segurança real é a RLS (§15.1).
 */
export interface SupabaseConfig {
  url: string;
  anonKey: string;
}
