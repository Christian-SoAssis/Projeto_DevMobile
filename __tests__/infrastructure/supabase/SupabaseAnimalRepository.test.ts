import {
  SupabaseAnimalRepository,
  StaleVersionError,
  RemoteSupabaseError,
} from '../../../src/infrastructure/supabase/repositories/SupabaseAnimalRepository';
import { SupabaseClientLike } from '../../../src/infrastructure/supabase/types';
import { Animal } from '../../../src/domain/entities/Animal';
import { AnimalCharacteristics } from '../../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../../src/domain/value-objects/ApproximateLocation';
import { InMemorySqliteDriver } from '../../../src/infrastructure/database/sqlite/DatabaseDriver';
import { applyMigrations } from '../../../src/infrastructure/database/sqlite/migrations';
import { SqliteAnimalRepository } from '../../../src/infrastructure/database/sqlite/repositories/SqliteAnimalRepository';
import { FakeSupabaseClient, FakeSupabaseContext, seedFakeDb } from '../../../test-support/SupabaseFake';

const OWNER_ROW = {
  id: 'animal_100',
  owner_id: 'usr_1',
  name: 'Luna',
  species: 'Cão',
  size: 'Pequeno',
  approximate_age: '2 anos',
  sex: 'Fêmea',
  description: 'Dócil',
  health_notes: 'Vacinada',
  special_care: 'Nenhum',
  status: 'AVAILABLE',
  moderation_status: 'NONE',
  neighborhood: 'Centro',
  city: 'Varginha',
  region: 'MG',
  latitude: -21.55,
  longitude: -45.44,
  created_at: '2026-11-01T10:00:00.000Z',
  updated_at: '2026-11-01T10:00:00.000Z',
  version: 1,
};

function makeAnimal(id = 'animal_100', version = 1): Animal {
  return new Animal({
    id,
    ownerId: 'usr_1',
    name: 'Luna',
    characteristics: new AnimalCharacteristics({
      species: 'Cão',
      size: 'Pequeno',
      approximateAge: '2 anos',
      sex: 'Fêmea',
    }),
    location: new ApproximateLocation({
      latitude: -21.55,
      longitude: -45.44,
      neighborhood: 'Centro',
      city: 'Varginha',
      region: 'MG',
    }),
    version,
  });
}

function repoFor(ctx: FakeSupabaseContext) {
  const client: SupabaseClientLike = new FakeSupabaseClient({ context: ctx });
  const db = new InMemorySqliteDriver();
  applyMigrations(db);
  const local = new SqliteAnimalRepository(db);
  return { repo: new SupabaseAnimalRepository({ local, client }), ctx };
}

describe('SupabaseAnimalRepository — decorador offline-first com perna remota real', () => {
  it('delegação local: findById/search/saveLocal continuam no SQLite (RNF01)', async () => {
    const db = new InMemorySqliteDriver();
    applyMigrations(db);
    const local = new SqliteAnimalRepository(db);
    const repo = new SupabaseAnimalRepository({
      local,
      client: new FakeSupabaseClient({ context: { db: seedFakeDb(), currentUserId: null, isAdmin: false } }),
    });

    await repo.saveLocal(makeAnimal());
    const found = await repo.findById('animal_100');
    expect(found?.name).toBe('Luna');
    expect((await repo.search({})).length).toBe(1);
  });

  describe('createRemote', () => {
    it('insere no Postgres e devolve o Animal mapeado da linha real', async () => {
      const db = seedFakeDb();
      const { repo } = repoFor({ db, currentUserId: 'usr_1', isAdmin: false });

      const remote = await repo.createRemote(makeAnimal());

      expect(db.animals).toHaveLength(1);
      const row = db.animals[0];
      expect(row.owner_id).toBe('usr_1');
      expect(row.name).toBe('Luna');
      expect(row.species).toBe('Cão');
      expect(row.city).toBe('Varginha');
      expect(remote.version).toBe(1);
      expect(remote.status.value).toBe('AVAILABLE');
      expect(remote.characteristics.species).toBe('Cão');
    });

    /**
     * OFF-05/DAT-08 (cenário T04 do checklist de arquitetura): o servidor
     * gravou o insert, a resposta se perdeu e o worker reenvia a mesma ação
     * CREATE. O reenvio chega como violação de chave primária (`23505`) e,
     * pelo id local ESTÁVEL (UUID compartilhado), é o MESMO anúncio: o
     * reenvio deve convergir — reenvio idempotente, sem diagnóstico
     * permanente de erro nem duplicação.
     */
    it('reenvio com confirmação perdida converge em sucesso (T04 — mesmo id, mesmo dono)', async () => {
      const db = seedFakeDb();
      const { repo } = repoFor({ db, currentUserId: 'usr_1', isAdmin: false });
      // 1ª tentativa gravou no servidor; o cliente perdeu a confirmação.
      db.animals.push({ ...OWNER_ROW });

      const remote = await repo.createRemote(makeAnimal());

      expect(db.animals).toHaveLength(1); // sem duplicar linha
      expect(remote.id).toBe('animal_100');
      expect(remote.ownerId).toBe('usr_1');
      expect(remote.name).toBe('Luna');
    });

    /**
     * Defesa em profundidade (DAT-05): `23505` só é sucesso se o registro
     * conflitante for do próprio usuário. Id de terceiro é erro de verdade
     * — a re-leitura pela RLS não devolve a linha alheia.
     */
    it('23505 de registro de OUTRO usuário permanece erro', async () => {
      const db = seedFakeDb();
      const { repo } = repoFor({ db, currentUserId: 'usr_1', isAdmin: false });
      db.animals.push({ ...OWNER_ROW, owner_id: 'usr_2' });

      await expect(repo.createRemote(makeAnimal())).rejects.toThrow(RemoteSupabaseError);
      expect(db.animals).toHaveLength(1); // linha alheia intocada
    });

    it('RLS: anônimo não consegue CREATE — erro do Postgres vira RemoteSupabaseError', async () => {
      const { repo } = repoFor({ db: seedFakeDb(), currentUserId: null, isAdmin: false });

      await expect(repo.createRemote(makeAnimal())).rejects.toBeInstanceOf(RemoteSupabaseError);
    });
  });

  describe('updateRemote + bloqueio otimista (doc §14.3)', () => {
    it('com version atual → UPDATE aplicado e Animal retornado', async () => {
      const db = seedFakeDb({ animals: [{ ...OWNER_ROW }] });
      const { repo } = repoFor({ db, currentUserId: 'usr_1', isAdmin: false });

      const edited = new Animal({
        id: 'animal_100',
        ownerId: 'usr_1',
        name: 'Luna Editada',
        characteristics: new AnimalCharacteristics({
          species: 'Cão',
          size: 'Pequeno',
          approximateAge: '3 anos',
          sex: 'Fêmea',
        }),
        location: new ApproximateLocation({
          latitude: -21.55,
          longitude: -45.44,
          neighborhood: 'Centro',
          city: 'Varginha',
          region: 'MG',
        }),
        version: 2,
      });

      const remote = await repo.updateRemote(edited);

      expect(remote.name).toBe('Luna Editada');
      expect(db.animals[0].name).toBe('Luna Editada');
      expect(db.animals[0].approximate_age).toBe('3 anos');
    });

    it('UPDATE com version antiga é rejeitado com StaleVersionError (doc §14.3)', async () => {
      const db = seedFakeDb({ animals: [{ ...OWNER_ROW, version: 3 }] });
      const { repo } = repoFor({ db, currentUserId: 'usr_1', isAdmin: false });

      const stale = makeAnimal('animal_100', 2); // servidor em 3, cliente em 2
      await expect(repo.updateRemote(stale)).rejects.toBeInstanceOf(StaleVersionError);
      expect(db.animals[0].version).toBe(3); // nada foi tocado
    });

    it('edição por terceiro é bloqueada pela RLS (§15.3) — zero linhas → rejeitado', async () => {
      const db = seedFakeDb({ animals: [{ ...OWNER_ROW }] });
      const { repo } = repoFor({ db, currentUserId: 'usr_9', isAdmin: false }); // não é o dono

      const intruder = makeAnimal('animal_100', 1);
      await expect(repo.updateRemote(intruder)).rejects.toBeInstanceOf(StaleVersionError);
      expect(db.animals[0].name).toBe('Luna'); // nada foi tocado
    });

    it('erro de rede do Postgres vira rejeição com a mensagem original do SDK', async () => {
      // Fake abertamente ruim: a cadeia explodir é transformada em rejeição.
      const brokenClient = {
        auth: {} as never,
        from: () => {
          throw new Error('network offline');
        },
      } as unknown as SupabaseClientLike;
      const db = new InMemorySqliteDriver();
      applyMigrations(db);
      const repo = new SupabaseAnimalRepository({ local: new SqliteAnimalRepository(db), client: brokenClient });

      await expect(repo.updateRemote(makeAnimal())).rejects.toThrow('network offline');
    });
  });

  describe('deleteRemote (idempotente — pré-requisito da fila RF19)', () => {
    it('remove o registro do próprio usuário', async () => {
      const db = seedFakeDb({ animals: [{ ...OWNER_ROW }] });
      const { repo } = repoFor({ db, currentUserId: 'usr_1', isAdmin: false });

      await repo.deleteRemote('animal_100');
      expect(db.animals).toHaveLength(0);
    });

    it('registro já ausente NÃO é erro (fila reenviada sem crash)', async () => {
      const { repo } = repoFor({ db: seedFakeDb(), currentUserId: 'usr_1', isAdmin: false });
      await expect(repo.deleteRemote('anim_inexistente')).resolves.toBeUndefined();
    });
  });

  describe('listPublicRemote — leitura pública de anúncios visíveis (§15.1)', () => {
    it('retorna AVAILABLE não-moderados e exclui HIDDEN (política animals_read_public)', async () => {
      const db = seedFakeDb({
        animals: [
          { ...OWNER_ROW, id: 'anim_visible' },
          { ...OWNER_ROW, id: 'anim_hidden', moderation_status: 'HIDDEN' },
          { ...OWNER_ROW, id: 'anim_adopted', status: 'ADOPTED' },
        ],
      });
      const { repo } = repoFor({ db, currentUserId: null, isAdmin: false });

      const visible = await repo.listPublicRemote();

      expect(visible.map((a) => a.id)).toEqual(['anim_visible']);
    });
  });
});
