export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface SupabaseClientLike {
  from(table: string): any;
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
