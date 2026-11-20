import { SupabaseAuthGateway } from '../../../infrastructure/supabase/auth/SupabaseAuthGateway';
import { User } from '../../../domain/entities/User';

function makeSupabaseClient(overrides: Record<string, any> = {}) {
  const auth = {
    signInWithPassword: jest.fn().mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'test@test.com', user_metadata: { name: 'Test User', phone: '35999990000' } },
        session: { access_token: 'token-abc', user: { id: 'user-1', email: 'test@test.com' } },
      },
      error: null,
    }),
    signUp: jest.fn().mockResolvedValue({
      data: { user: { id: 'user-1', email: 'test@test.com' }, session: { access_token: 'token-abc' } },
      error: null,
    }),
    getSession: jest.fn().mockResolvedValue({
      data: { session: { user: { id: 'user-1', email: 'test@test.com', user_metadata: { name: 'Test User', phone: '35999990000' } }, access_token: 'token-abc' } },
      error: null,
    }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    ...overrides.auth,
  };

  const from = jest.fn((table: string) => {
    const rows: any[] = [];
    const chain: any = {
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      ...overrides[table],
    };
    chain.select = jest.fn().mockReturnThis();
    return chain;
  });

  return { auth, from } as any;
}

describe('SupabaseAuthGateway (DAT-03)', () => {
  it('deve fazer login com sucesso e retornar sessão', async () => {
    const client = makeSupabaseClient();
    const gateway = new SupabaseAuthGateway(client);

    const session = await gateway.login('test@test.com', 'senha123');

    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@test.com',
      password: 'senha123',
    });
    expect(session.user.id).toBe('user-1');
    expect(session.accessToken).toBe('token-abc');
    expect(session.user.email).toBe('test@test.com');
  });

  it('deve lançar erro quando login falha', async () => {
    const client = makeSupabaseClient({
      auth: {
        signInWithPassword: jest.fn().mockResolvedValue({
          data: { user: null, session: null },
          error: { message: 'Invalid login credentials' },
        }),
      },
    });
    const gateway = new SupabaseAuthGateway(client);

    await expect(gateway.login('test@test.com', 'wrong')).rejects.toThrow(
      'Invalid login credentials'
    );
  });

  it('deve fazer registro com sucesso', async () => {
    const client = makeSupabaseClient();
    const gateway = new SupabaseAuthGateway(client);

    const session = await gateway.register({
      name: 'Usuario Novo',
      email: 'novo@test.com',
      contactInfo: '35999990000',
      password: 'senha1234',
    });

    expect(client.auth.signUp).toHaveBeenCalled();
    expect(session.user.id).toBe('user-1');
    expect(session.user.email).toBe('novo@test.com');
  });

  it('deve lançar erro se senha tiver menos de 6 caracteres no registro', async () => {
    const client = makeSupabaseClient();
    const gateway = new SupabaseAuthGateway(client);

    await expect(
      gateway.register({
        name: 'Usuario Novo',
        email: 'novo@test.com',
        password: '123',
      })
    ).rejects.toThrow('A senha deve ter pelo menos 6 caracteres.');
  });

  it('deve restaurar sessão existente', async () => {
    const client = makeSupabaseClient();
    const gateway = new SupabaseAuthGateway(client);

    const session = await gateway.restoreSession();

    expect(client.auth.getSession).toHaveBeenCalled();
    expect(session).not.toBeNull();
    expect(session?.user.id).toBe('user-1');
    expect(session?.accessToken).toBe('token-abc');
  });

  it('deve retornar null ao restaurar sessão sem sessão ativa', async () => {
    const client = makeSupabaseClient({
      auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      },
    });
    const gateway = new SupabaseAuthGateway(client);

    const session = await gateway.restoreSession();
    expect(session).toBeNull();
  });

  it('deve fazer logout com sucesso', async () => {
    const client = makeSupabaseClient();
    const gateway = new SupabaseAuthGateway(client);

    await expect(gateway.logout()).resolves.toBeUndefined();
    expect(client.auth.signOut).toHaveBeenCalled();
  });

  it('deve atualizar perfil do usuário', async () => {
    const client = makeSupabaseClient({
      profiles: {
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
      },
    });
    const gateway = new SupabaseAuthGateway(client);

    const user = await gateway.updateProfile({
      userId: 'user-1',
      name: 'Nome Atualizado',
      contactInfo: '35999990000',
      bio: 'Bio do usuário',
      avatarUrl: 'https://avatar.url',
      interestsTags: ['Cães'],
    });

    expect(user).toBeInstanceOf(User);
    expect(user.name).toBe('Nome Atualizado');
    expect(client.from('profiles').upsert).toHaveBeenCalled();
  });
});
