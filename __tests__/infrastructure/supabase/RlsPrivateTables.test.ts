import {
  FakeSupabaseClient,
  seedFakeDb,
  FakeSupabaseDb,
} from '../../../test-support/SupabaseFake';

/**
 * Doc §15.1 — "favoritos e interesses protegidos". As tabelas privadas só
 * são acessíveis ao próprio usuário autenticado (e ao admin): sem credencial
 * a leitura devolve vazio e a escrita é bloqueada por RLS, mesmo que o
 * `insert` chegue a ser tentado. No projeto real quem autoriza é o Postgres
 * (`favorites_owner_all`/`interests_owner_all`); o fake
 * (`test-support/SupabaseFake.ts`) reproduta essa semântica: linha cuja
 * coluna de posse é `user_id` só é visível/gravável pelo próprio usuário.
 */
const PRIVATE_TABLES = ['favorites', 'adoption_interests'] as const;

const TERCEIRO = 'usr_terceiro';

function seededDb(minhaUserId: string | null): FakeSupabaseDb {
  const minha = minhaUserId ?? 'usr_visitante';
  return seedFakeDb({
    favorites: [
      { id: 'minha_linha', user_id: minha, animal_id: 'anim_1' },
      { id: 'linha_alheia', user_id: TERCEIRO, animal_id: 'anim_1' },
    ],
    adoption_interests: [
      { id: 'meu_interesse', user_id: minha, animal_id: 'anim_1', message: 'Tenho interesse.' },
      { id: 'interesse_alheio', user_id: TERCEIRO, animal_id: 'anim_1', message: 'Pronto para adotar.' },
    ],
  });
}

describe('RLS — tabelas privadas por usuário (doc §15.1: favoritos/interesses protegidos)', () => {
  it.each(PRIVATE_TABLES)(
    '%s: usuário autenticado vê apenas as PRÓPRIAS linhas — nada de terceiro',
    async (table) => {
      const client = new FakeSupabaseClient({
        context: { db: seededDb('usr_7'), currentUserId: 'usr_7', isAdmin: false },
      });
      const { data } = await client.from(table).select();
      if (table === 'favorites') {
        expect((data ?? []).map((r) => r.id)).toEqual(['minha_linha']);
      } else {
        expect((data ?? []).map((r) => r.id)).toEqual(['meu_interesse']);
      }
    }
  );

  it.each(PRIVATE_TABLES)(
    '%s: visitante anônimo não lê nada — leitura devolve vazia (protegido até de anônimo)',
    async (table) => {
      const client = new FakeSupabaseClient({
        context: { db: seededDb(null), currentUserId: null, isAdmin: false },
      });
      const { data } = await client.from(table).select();
      expect(data ?? []).toEqual([]);
    }
  );

  it.each(PRIVATE_TABLES)(
    '%s: anônimo NÃO insere linha (RLS devolve erro de política)',
    async (table) => {
      const client = new FakeSupabaseClient({
        context: { db: seededDb(null), currentUserId: null, isAdmin: false },
      });
      const { error } = await client
        .from(table)
        .insert({ id: 'nova_linha', user_id: TERCEIRO, animal_id: 'anim_1' })
        .select();
      expect(error).not.toBeNull();
      expect(String(error?.message)).toMatch(/row-level security/i);
    }
  );

  it.each(PRIVATE_TABLES)(
    '%s: usuário autenticado NÃO inscreve linha com user_id de outro (RLS bloqueia)',
    async (table) => {
      const client = new FakeSupabaseClient({
        context: { db: seededDb('usr_7'), currentUserId: 'usr_7', isAdmin: false },
      });
      const { error } = await client
        .from(table)
        .insert({ id: 'linha_esperta', user_id: TERCEIRO, animal_id: 'anim_1' })
        .select();
      expect(error).not.toBeNull();
      expect(String(error?.message)).toMatch(/row-level security/i);
    }
  );

  it('favorites: dono grava e lê a própria linha (caminho legítimo segue aberto)', async () => {
    const ctx = { db: seededDb('usr_1'), currentUserId: 'usr_1' as string | null, isAdmin: false };
    const client = new FakeSupabaseClient({ context: { ...ctx, isAdmin: false } });

    const inserted = await client
      .from('favorites')
      .insert({ id: 'meu_fav_novo', user_id: 'usr_1', animal_id: 'anim_9' })
      .select();
    expect(inserted.error).toBeNull();
    expect(inserted.data ?? []).toHaveLength(1);

    const own = await client.from('favorites').select();
    expect((own.data ?? []).map((r) => r.id)).toContain('meu_fav_novo');
  });

  it('favorites: admin enxerga todas as linhas (manutenção/administrativo)', async () => {
    const client = new FakeSupabaseClient({
      context: { db: seededDb('usr_1'), currentUserId: 'adm_9', isAdmin: true },
    });
    const all = await client.from('favorites').select();
    expect((all.data ?? []).map((r) => r.id)).toEqual(['minha_linha', 'linha_alheia']);
  });
});
