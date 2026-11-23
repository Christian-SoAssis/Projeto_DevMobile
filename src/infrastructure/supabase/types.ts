import { Database, PublicTableName } from './database.types';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface SupabaseQueryResult<T = any> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

export interface SupabaseQueryBuilder<
  TableSpec extends { Row: Record<string, any>; Insert: Record<string, any>; Update: Record<string, any> }
> extends PromiseLike<SupabaseQueryResult<any>> {
  select(columns?: string): SupabaseQueryBuilder<TableSpec>;
  eq<K extends keyof TableSpec['Row'] & string>(
    column: K,
    value: TableSpec['Row'][K]
  ): SupabaseQueryBuilder<TableSpec>;
  neq<K extends keyof TableSpec['Row'] & string>(
    column: K,
    value: TableSpec['Row'][K]
  ): SupabaseQueryBuilder<TableSpec>;
  gt<K extends keyof TableSpec['Row'] & string>(
    column: K,
    value: TableSpec['Row'][K]
  ): SupabaseQueryBuilder<TableSpec>;
  gte<K extends keyof TableSpec['Row'] & string>(
    column: K,
    value: TableSpec['Row'][K]
  ): SupabaseQueryBuilder<TableSpec>;
  order<K extends keyof TableSpec['Row'] & string>(
    column: K,
    options?: { ascending?: boolean }
  ): SupabaseQueryBuilder<TableSpec>;
  limit(count: number): SupabaseQueryBuilder<TableSpec>;
  maybeSingle(): PromiseLike<SupabaseQueryResult<any>>;
  single(): PromiseLike<SupabaseQueryResult<any>>;
  insert(
    values: TableSpec['Insert'] | TableSpec['Insert'][]
  ): SupabaseQueryBuilder<TableSpec>;
  upsert(
    values: TableSpec['Insert'] | TableSpec['Insert'][],
    options?: { onConflict?: string }
  ): SupabaseQueryBuilder<TableSpec>;
  update(values: TableSpec['Update']): SupabaseQueryBuilder<TableSpec>;
  delete(): SupabaseQueryBuilder<TableSpec>;
}

export interface SupabaseClientLike {
  from<T extends PublicTableName>(
    table: T
  ): SupabaseQueryBuilder<Database['public']['Tables'][T]>;
  auth: {
    getSession(): Promise<{ data: { session: any | null }; error: any | null }>;
    signInWithPassword(credentials: { email: string; password: string }): Promise<{
      data: { user: any | null; session: any | null };
      error: any | null;
    }>;
    signUp(credentials: {
      email: string;
      password: string;
      options?: { data?: Record<string, unknown> };
    }): Promise<{
      data: { user: any | null; session: any | null };
      error: any | null;
    }>;
    signOut(): Promise<{ error: any | null }>;
    onAuthStateChange?(callback: (event: string, session: any | null) => void): {
      data: { subscription: { unsubscribe(): void } };
    };
  };
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        body: Uint8Array | ArrayBuffer,
        options?: { contentType?: string; upsert?: boolean }
      ): Promise<{ data: any; error: { message: string } | null }>;
      getPublicUrl(path: string): { data: { publicUrl: string } };
      remove?(paths: string[]): Promise<{ data: any; error: any }>;
    };
  };
}

export interface SupabaseModuleLike {
  createClient(url: string, key: string, options?: Record<string, unknown>): SupabaseClientLike;
}
