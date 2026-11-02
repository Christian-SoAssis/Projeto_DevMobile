import { SupabaseModerationRepository } from '../../../src/infrastructure/supabase/repositories/SupabaseModerationRepository';
import { SupabaseClientLike } from '../../../src/infrastructure/supabase/types';
import { FakeSupabaseClient, seedFakeDb } from '../../../test-support/SupabaseFake';

/**
 * Doc §15.1 — políticas de moderação (`USING is_admin()`). O adapter só
 * escreve `moderation_status`; quem autoriza é o RLS. Tipos definitivos de
 * ação seguem bloqueados no §4 (HIDE/UNHIDE são o mínimo provisório).
 */
describe('SupabaseModerationRepository (primeira barreira é o use case; esta é a segunda)', () => {
  function makeDbWithAnimal() {
    const db = seedFakeDb({
      animals: [
        { id: 'anim_1', owner_id: 'usr_1', name: 'Luna', moderation_status: 'NONE' },
      ],
    });
    const client: SupabaseClientLike = new FakeSupabaseClient({
      context: { db, currentUserId: 'adm_1', isAdmin: true },
    });
    return { repo: new SupabaseModerationRepository({ client }), db };
  }

  it('HIDE marca moderation_status HIDDEN com data de moderação', async () => {
    const { repo, db } = makeDbWithAnimal();

    await repo.moderateAnimal('anim_1', 'HIDE');

    expect(db.animals[0].moderation_status).toBe('HIDDEN');
    expect(typeof db.animals[0].moderated_at).toBe('string');
  });

  it('UNHIDE restaura NONE e limpa a data', async () => {
    const { repo, db } = makeDbWithAnimal();
    db.animals[0].moderation_status = 'HIDDEN';
    db.animals[0].moderated_at = new Date().toISOString();

    await repo.moderateAnimal('anim_1', 'UNHIDE');

    expect(db.animals[0].moderation_status).toBe('NONE');
    expect(db.animals[0].moderated_at).toBeNull();
  });

  it('erro do Postgres vira RemoteSupabaseError com a mensagem original', async () => {
    const db = seedFakeDb();
    const brokenClient = {
      auth: {} as never,
      from: () => {
        throw new Error('postgrest down');
      },
    } as unknown as SupabaseClientLike;
    const repo = new SupabaseModerationRepository({ client: brokenClient });

    await expect(repo.moderateAnimal('anim_1', 'HIDE')).rejects.toThrow('postgrest down');
    expect(db.animals).toHaveLength(0);
  });
});
