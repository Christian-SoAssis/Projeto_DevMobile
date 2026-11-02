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

describe('SupabaseAuthGateway.register (signUp e-mail/senha)', () => {
  function gatewayWith(signUp: SupabaseAuthApi['signUp']) {
    const client: SupabaseClientLike = new FakeSupabaseClient({
      context: { db: { animals: [], users: [] }, currentUserId: null, isAdmin: false },
      authHandlers: { signUp },
    });
    return { gw: new SupabaseAuthGateway({ client }), client };
  }

  it('envia nome/telefone como metadata e nunca o papel', async () => {
    const signUp = jest.fn(async () => ({
      data: {
        user: { id: 'u-1', email: 'maria@test.com' },
        session: { access_token: 't', user: { id: 'u-1' } },
      },
      error: null,
    }));
    const { gw } = gatewayWith(signUp);

    const res = await gw.register({
      name: ' Maria ',
      email: ' maria@test.com ',
      phone: '35 99999-0000',
      password: 'senha123',
    });

    expect(signUp).toHaveBeenCalledWith({
      email: 'maria@test.com',
      password: 'senha123',
      options: { data: { name: 'Maria', phone: '35 99999-0000' } },
    });
    expect(res.user.role).toBe('USER');
    expect(res.user.name).toBe('Maria');
    expect(res.needsEmailConfirmation).toBe(false);
  });

  it('sem sessão → pede confirmação de e-mail', async () => {
    const { gw } = gatewayWith(async () => ({
      data: { user: { id: 'u-2', email: 'a@test.com' }, session: null },
      error: null,
    }));
    const res = await gw.register({ name: 'A', email: 'a@test.com', password: 'senha123' });
    expect(res.needsEmailConfirmation).toBe(true);
  });

  it('e-mail já cadastrado (erro ou identities vazio) → mensagem amigável', async () => {
    const dup = gatewayWith(async () => ({
      data: { user: null, session: null },
      error: { message: 'User already registered' },
    }));
    await expect(
      dup.gw.register({ name: 'A', email: 'a@test.com', password: 'senha123' })
    ).rejects.toThrow('E-mail já cadastrado.');

    const silent = gatewayWith(async () => ({
      data: { user: { id: 'u-3', email: 'a@test.com', identities: [] } as any, session: null },
      error: null,
    }));
    await expect(
      silent.gw.register({ name: 'A', email: 'a@test.com', password: 'senha123' })
    ).rejects.toThrow('E-mail já cadastrado.');
  });

  it('senha fraca, sem usuário e rede fora → erros tratados', async () => {
    await expect(
      gatewayWith(async () => ({
        data: { user: null, session: null },
        error: { message: 'Password should be at least 6 characters' },
      })).gw.register({ name: 'A', email: 'a@test.com', password: '1' })
    ).rejects.toThrow('Senha muito fraca');

    await expect(
      gatewayWith(async () => ({ data: { user: null, session: null }, error: null })).gw.register({
        name: 'A',
        email: 'a@test.com',
        password: 'senha123',
      })
    ).rejects.toThrow('Não foi possível concluir o cadastro.');
  });
});

describe('SupabaseAuthGateway.updateProfile (RLS users_update_own)', () => {
  const { User } = require('../../../src/domain/entities/User');
  const { ContactInfo } = require('../../../src/domain/value-objects/ContactInfo');
  const me = () =>
    new User({
      id: 'u-1',
      name: 'Ana Maria',
      contactInfo: new ContactInfo('ana@test.com', '11888'),
      bio: 'Amo gatos',
      interests: ['Gatos'],
    });

  function gatewayFor(currentUserId: string | null, db = { animals: [], users: [{ id: 'u-1', name: 'Ana', user_type: 'USER' }] }) {
    const client: SupabaseClientLike = new FakeSupabaseClient({
      context: { db, currentUserId, isAdmin: false },
    });
    return { gw: new SupabaseAuthGateway({ client }), db };
  }

  it('grava nome, telefone, descrição e interesses na própria linha — sem tocar no papel', async () => {
    const { gw, db } = gatewayFor('u-1');
    await gw.updateProfile(me());
    expect(db.users[0]).toMatchObject({
      name: 'Ana Maria',
      phone: '11888',
      bio: 'Amo gatos',
      interests: ['Gatos'],
      user_type: 'USER',
    });
  });

  it('terceiro/anônimo: RLS devolve zero linhas → erro e nada é gravado', async () => {
    for (const uid of ['outro', null]) {
      const { gw, db } = gatewayFor(uid);
      await expect(gw.updateProfile(me())).rejects.toThrow('Não foi possível salvar o perfil no servidor.');
      expect(db.users[0]).toMatchObject({ name: 'Ana' });
    }
  });

  it('erro do servidor e falha de rede viram mensagem amigável', async () => {
    const failing = (impl: () => any): SupabaseAuthGateway =>
      new SupabaseAuthGateway({
        client: {
          auth: {} as any,
          from: () => ({ update: () => ({ eq: () => ({ select: impl }) }) }) as any,
        } as unknown as SupabaseClientLike,
      });
    await expect(
      failing(() => Promise.resolve({ data: null, error: { message: 'Failed to fetch' } })).updateProfile(me())
    ).rejects.toThrow('Sem conexão com o servidor.');
    await expect(
      failing(() => Promise.reject(new Error('network down'))).updateProfile(me())
    ).rejects.toThrow('Sem conexão com o servidor.');
  });

  it('avatar_url é gravado e lido no perfil', async () => {
    const { gw, db } = gatewayFor('u-1');
    await gw.updateProfile(me().withProfile({ avatarUrl: 'https://cdn/a.webp' }));
    expect(db.users[0]).toMatchObject({ avatar_url: 'https://cdn/a.webp' });
    await gw.updateProfile(me());
    expect(db.users[0]).toMatchObject({ avatar_url: null });
  });
});
