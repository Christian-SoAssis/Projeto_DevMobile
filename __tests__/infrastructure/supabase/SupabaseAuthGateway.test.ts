import { SupabaseAuthGateway } from '../../../src/infrastructure/supabase/auth/SupabaseAuthGateway';
import {
  SupabaseAuthApi,
  SupabaseClientLike,
} from '../../../src/infrastructure/supabase/types';
import { FakeSupabaseClient, FakeSupabaseContext } from '../../../test-support/SupabaseFake';

/**
 * RF07 — autenticação real (Supabase e-mail/senha — decisão §4).
 * Doc §16.3 Supabase: login válido/inválido, sessão, logout.
 */
describe('SupabaseAuthGateway (e-mail/senha)', () => {
  function gatewayFor(authHandlers: Partial<SupabaseAuthApi> = {}): SupabaseAuthGateway {
    const client: SupabaseClientLike = new FakeSupabaseClient({
      context: { db: { animals: [], users: [] }, currentUserId: null, isAdmin: false },
      authHandlers: authHandlers,
    });
    return new SupabaseAuthGateway({ client });
  }

  it('login válido → AuthSession com token e User de domínio (e-mail/senha)', async () => {
    const gw = gatewayFor({
      signInWithPassword: async () => ({
        data: {
          session: {
            access_token: 'jwt_token_1',
            user: {
              id: '3e0d7a30-1111-4444-8888-999999999999',
              email: 'ana@test.com',
              user_metadata: { name: 'Ana', phone: '35 99999-0000', user_type: 'USER' },
            },
          },
        },
        error: null,
      }),
    });

    const session = await gw.login('ana@test.com', 'senha123');

    expect(session.token).toBe('jwt_token_1');
    expect(session.user.id).toBe('3e0d7a30-1111-4444-8888-999999999999');
    expect(session.user.name).toBe('Ana');
    expect(session.user.contactInfo.email).toBe('ana@test.com');
    expect(session.user.contactInfo.phone).toBe('35 99999-0000');
    expect(session.user.role).toBe('USER');
  });

  it('credenciais erradas → mensagem amigável (não vaza erro bruto do SDK)', async () => {
    const gw = gatewayFor({
      signInWithPassword: async () => ({
        data: { session: null },
        error: { message: 'Invalid login credentials' },
      }),
    });

    await expect(gw.login('ana@test.com', 'errada')).rejects.toThrow('E-mail ou senha incorretos.');
  });

  it('sem internet → mensagem orienta o modo offline e não crasha o app', async () => {
    const gw = gatewayFor({
      signInWithPassword: async () => ({
        data: { session: null },
        error: { message: 'Failed to fetch: network error' },
      }),
    });

    await expect(gw.login('ana@test.com', 'senha')).rejects.toThrow(/offline/);
  });

  it('sessão atual existente → AuthSession; ausentes → null (boot limpo)', async () => {
    const sessionFixed = {
      access_token: 'jwt_atual',
      user: { id: 'u-uuid-1', email: 'ana@test.com', user_metadata: { name: 'Ana' } },
    };
    const gwComSessao = gatewayFor({
      getSession: async () => ({ data: { session: sessionFixed }, error: null }),
    });
    const gwSemSessao = gatewayFor({});

    expect((await gwComSessao.getCurrentSession())?.token).toBe('jwt_atual');
    expect(await gwSemSessao.getCurrentSession()).toBeNull();
  });

  it('acessarViaToken valida o JWT e devolve sessão; token ruim → orienta refazer login', async () => {
    const gwOk = gatewayFor({
      getUser: async () => ({
        data: {
          user: { id: 'uuid-2', email: 'beto@test.com', user_metadata: { name: 'Beto' } },
        },
        error: null,
      }),
    });
    const session = await gwOk.acessarViaToken('jwt_valido');
    expect(session.token).toBe('jwt_valido');
    expect(session.user.name).toBe('Beto');

    const gwNok = gatewayFor({
      getUser: async () => ({ data: { user: null }, error: { message: 'invalid JWT' } }),
    });
    await expect(gwNok.acessarViaToken('jwt_podre')).rejects.toThrow('Sessão expirada. Faça login novamente.');
  });

  it('papel ADMIN lido do perfil public.users (fonte autoritativa — RLS do próprio perfil)', async () => {
    const db = {
      animals: [],
      users: [
        { id: 'adm-uuid', user_type: 'ADMIN', name: 'Carla Admin', email: 'carla@ong.org', phone: null },
      ],
    } satisfies FakeSupabaseContext['db'];
    const client: SupabaseClientLike = new FakeSupabaseClient({
      context: { db, currentUserId: 'adm-uuid', isAdmin: false },
      authHandlers: {
        signInWithPassword: async () => ({
          data: { session: { access_token: 'jwt_admin', user: { id: 'adm-uuid', email: 'carla@ong.org', user_metadata: {} } } },
          error: null,
        }),
      },
    });

    const session = await new SupabaseAuthGateway({ client }).login('carla@ong.org', 'senha');

    expect(session.user.role).toBe('ADMIN');
    expect(session.user.name).toBe('Carla Admin');
  });

  it('logout com sucesso resolve; erro do Postgres vira mensagem tratada', async () => {
    const gwOk = gatewayFor({ signOut: async () => ({ error: null }) });
    await expect(gwOk.logout()).resolves.toBeUndefined();

    const gwNok = gatewayFor({
      signOut: async () => ({ error: { message: 'session not found' } }),
    });
    await expect(gwNok.logout()).rejects.toThrow(/encerrar a sessão/);
  });
});
