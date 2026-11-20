export const createClient = jest.fn(() => {
  const tables: Record<string, any[]> = {};

  return {
    from: (table: string) => {
      if (!tables[table]) tables[table] = [];
      return {
        select: jest.fn(() => ({
          data: tables[table],
          error: null,
        })),
        insert: jest.fn((row: any) => {
          tables[table].push(row);
          return { data: [row], error: null };
        }),
        update: jest.fn((row: any) => {
          const idx = tables[table].findIndex((r) => r.id === row.id);
          if (idx >= 0) tables[table][idx] = { ...tables[table][idx], ...row };
          return { data: [tables[table][idx]], error: null };
        }),
        delete: jest.fn(() => {
          tables[table] = [];
          return { error: null };
        }),
        eq: jest.fn(() => ({
          data: tables[table],
          error: null,
        })),
        order: jest.fn(() => ({
          data: tables[table],
          error: null,
        })),
        limit: jest.fn(() => ({
          data: tables[table],
          error: null,
        })),
        single: jest.fn(() => ({
          data: tables[table][0] ?? null,
          error: null,
        })),
      };
    },
    auth: {
      signInWithPassword: jest.fn(() => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } }, error: null })),
      signUp: jest.fn(() => Promise.resolve({ data: { user: { id: 'user-1', email: 'test@test.com' } }, error: null })),
      getSession: jest.fn(() => Promise.resolve({ data: { session: { user: { id: 'user-1', email: 'test@test.com' }, access_token: 'token' } }, error: null })),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      updateUser: jest.fn(() => Promise.resolve({ data: { user: { id: 'user-1' } }, error: null })),
    },
    storage: {
      from: (bucket: string) => ({
        upload: jest.fn(() => Promise.resolve({ data: { path: 'path/to/file' }, error: null })),
        download: jest.fn(() => Promise.resolve({ data: new Uint8Array(), error: null })),
        remove: jest.fn(() => Promise.resolve({ error: null })),
        createSignedUrl: jest.fn(() => Promise.resolve({ data: { signedUrl: 'https://signed.url' }, error: null })),
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://public.url' } })),
      }),
    },
  };
});

export default { createClient };
