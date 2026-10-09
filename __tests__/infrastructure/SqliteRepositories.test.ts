import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AdoptionInterest } from '../../src/domain/entities/AdoptionInterest';
import { Animal } from '../../src/domain/entities/Animal';
import { AnimalPhoto } from '../../src/domain/entities/AnimalPhoto';
import { Favorite } from '../../src/domain/entities/Favorite';
import { SyncAction } from '../../src/domain/entities/SyncAction';
import { User } from '../../src/domain/entities/User';
import { AnimalCharacteristics } from '../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../src/domain/value-objects/ApproximateLocation';
import { ContactInfo } from '../../src/domain/value-objects/ContactInfo';
import { SearchPreferences } from '../../src/domain/value-objects/SearchPreferences';
import type { AppDatabase, TransactionRunner } from '../../src/infrastructure/database/sqlite/connection';
import {
  INITIAL_SCHEMA_UP,
  applyMigrations,
  rollbackMigration,
  type MigrationExecutor,
} from '../../src/infrastructure/database/sqlite/migrations';
import * as schema from '../../src/infrastructure/database/sqlite/schema';
import { saveAnimalWithPendingAction } from '../../src/infrastructure/database/sqlite/unitOfWork';
import { SqliteAdoptionInterestRepository } from '../../src/infrastructure/database/sqlite/repositories/SqliteAdoptionInterestRepository';
import { SqliteAnimalRepository } from '../../src/infrastructure/database/sqlite/repositories/SqliteAnimalRepository';
import { SqliteFavoriteRepository } from '../../src/infrastructure/database/sqlite/repositories/SqliteFavoriteRepository';
import { SqliteSearchPreferencesRepository } from '../../src/infrastructure/database/sqlite/repositories/SqliteSearchPreferencesRepository';
import { SqliteSyncQueueRepository } from '../../src/infrastructure/database/sqlite/repositories/SqliteSyncQueueRepository';
import { SqliteUserRepository } from '../../src/infrastructure/database/sqlite/repositories/SqliteUserRepository';

const EXPECTED_TABLES = [
  'animals',
  'animal_photos',
  'favorites',
  'adoption_interests',
  'profiles',
  'sync_queue',
  'local_images',
  'sync_state',
  'search_preferences',
];

interface TestDb {
  file: string;
  raw: InstanceType<typeof Database>;
  db: AppDatabase;
  withTransaction: TransactionRunner;
  apply: () => Promise<number[]>;
}

function openTestDb(): TestDb {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'enlace-test-'));
  const file = path.join(dir, 'test.db');
  const raw = new Database(file);
  const executor: MigrationExecutor = {
    run: (sql: string) => {
      raw.exec(sql);
    },
    all: <T>(sql: string): T[] => raw.prepare(sql).all() as T[],
  };
  const db = drizzle(raw, { schema }) as unknown as AppDatabase;
  const withTransaction: TransactionRunner = async <T>(fn: (txDb: AppDatabase) => Promise<T>): Promise<T> => {
    raw.exec('BEGIN');
    try {
      const result = await fn(db);
      raw.exec('COMMIT');
      return result;
    } catch (err) {
      raw.exec('ROLLBACK');
      throw err;
    }
  };
  return { file, raw, db, withTransaction, apply: () => applyMigrations(executor) };
}

function closeTestDb(t: TestDb): void {
  t.raw.close();
}

function makeAnimal(id: string, overrides: Partial<{ name: string; species: string; city: string }> = {}): Animal {
  return new Animal({
    id,
    ownerId: 'usr_1',
    name: overrides.name ?? 'Luna',
    characteristics: new AnimalCharacteristics({
      species: overrides.species ?? 'Cão',
      size: 'Médio',
      approximateAge: '2 anos',
      sex: 'Macho',
      behavior: 'Dócil',
    }),
    location: new ApproximateLocation({
      latitude: -21.554,
      longitude: -45.435,
      neighborhood: 'Centro',
      city: overrides.city ?? 'Varginha',
      region: 'MG',
    }),
    photos: [new AnimalPhoto({ id: `photo_${id}`, animalId: id, remoteUrl: `https://exemplo/${id}.jpg` })],
  });
}

function makeAction(id: string, entityId: string, status?: 'PENDING' | 'FAILED' | 'COMPLETED'): SyncAction {
  const action = new SyncAction({
    id,
    operation: 'CREATE',
    entityType: 'animal',
    entityId,
    payload: { name: 'Luna', nested: { attempts: 0 } },
  });
  if (status === 'FAILED') action.markFailed('rede indisponível');
  if (status === 'COMPLETED') action.markCompleted();
  return action;
}

describe('Fase 2 — SQLite local (doc §16.3)', () => {
  it('migrations criam todas as tabelas e registram a versão', async () => {
    const t = openTestDb();
    try {
      const applied = await t.apply();
      expect(applied).toEqual([1]);
      const tables = (t.raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table';").all() as { name: string }[]).map(
        (r) => r.name
      );
      for (const expected of [...EXPECTED_TABLES, '_migrations']) {
        expect(tables).toContain(expected);
      }
      // Reaplicar é idempotente.
      expect(await t.apply()).toEqual([]);
    } finally {
      closeTestDb(t);
    }
  });

  it('DDL normativo (.sql) é idêntico ao `up` executável do registro', () => {
    const sqlFile = fs.readFileSync(
      path.join(__dirname, '../../src/infrastructure/database/sqlite/migrations/001_initial_schema.sql'),
      'utf8'
    );
    const normalize = (s: string) =>
      s
        .split('\n')
        .map((line) => line.split('--')[0])
        .join('\n')
        .replace(/\s+/g, ' ')
        .trim();
    expect(normalize(INITIAL_SCHEMA_UP)).toBe(normalize(sqlFile));
  });

  it('rollback remove as tabelas e a versão registrada', async () => {
    const t = openTestDb();
    try {
      await t.apply();
      await rollbackMigration(
        {
          run: (sql: string) => {
            t.raw.exec(sql);
          },
          all: <T>(sql: string): T[] => t.raw.prepare(sql).all() as T[],
        },
        1
      );
      const tables = (t.raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%';").all() as {
        name: string;
      }[]).map((r) => r.name);
      for (const expected of EXPECTED_TABLES) {
        expect(tables).not.toContain(expected);
      }
      await expect(
        rollbackMigration(
          {
            run: (sql: string) => {
              t.raw.exec(sql);
            },
            all: <T>(sql: string): T[] => t.raw.prepare(sql).all() as T[],
          },
          999
        )
      ).rejects.toThrow(/desconhecida/);
    } finally {
      closeTestDb(t);
    }
  });

  it('cache persiste após reinício (animais, fotos, favoritos, interesses, prefs, fila)', async () => {
    const t = openTestDb();
    await t.apply();
    const animals = new SqliteAnimalRepository(t.db);
    const favorites = new SqliteFavoriteRepository(t.db);
    const interests = new SqliteAdoptionInterestRepository(t.db);
    const prefs = new SqliteSearchPreferencesRepository(t.db);
    const queue = new SqliteSyncQueueRepository(t.db);

    await animals.saveLocal(makeAnimal('anim_1'));
    await favorites.addFavorite(new Favorite('usr_2', 'anim_1'));
    await interests.registerInterest(new AdoptionInterest('int_1', 'usr_2', 'anim_1'));
    await prefs.save('usr_2', new SearchPreferences({ species: 'Cão' }));
    await queue.enqueue(makeAction('q_1', 'anim_1'));
    closeTestDb(t);

    // Reabre o mesmo arquivo: tudo deve estar lá (RNF09).
    const raw2 = new Database(t.file);
    const db2 = drizzle(raw2, { schema }) as unknown as AppDatabase;
    try {
      const found = await new SqliteAnimalRepository(db2).findById('anim_1');
      expect(found?.name).toBe('Luna');
      expect(found?.photos).toHaveLength(1);
      expect(await new SqliteFavoriteRepository(db2).isFavorite('usr_2', 'anim_1')).toBe(true);
      expect(await new SqliteAdoptionInterestRepository(db2).hasInterest('usr_2', 'anim_1')).toBe(true);
      expect((await new SqliteSearchPreferencesRepository(db2).get('usr_2'))?.species).toBe('Cão');
      expect(await new SqliteSyncQueueRepository(db2).findById('q_1')).not.toBeNull();
    } finally {
      raw2.close();
    }
  });

  it('fila mantém payload e tentativas (sem perda silenciosa, RNF02)', async () => {
    const t = openTestDb();
    await t.apply();
    const queue = new SqliteSyncQueueRepository(t.db);
    try {
      const failed = makeAction('q_fail', 'anim_9', 'FAILED');
      await queue.enqueue(makeAction('q_pending', 'anim_1'));
      await queue.enqueue(failed);
      const completed = makeAction('q_done', 'anim_2', 'COMPLETED');
      await queue.enqueue(completed);

      const pending = await queue.listPending();
      expect(pending.map((a) => a.id).sort()).toEqual(['q_fail', 'q_pending']);
      const reloaded = await queue.findById('q_fail');
      expect(reloaded?.attempts).toBe(1);
      expect(reloaded?.status.isFailed()).toBe(true);
      expect(reloaded?.lastError).toBe('rede indisponível');
      expect(reloaded?.payload).toEqual({ name: 'Luna', nested: { attempts: 0 } });

      await queue.clearCompleted();
      expect(await queue.findById('q_done')).toBeNull();
      expect(await queue.findById('q_fail')).not.toBeNull();
    } finally {
      closeTestDb(t);
    }
  });

  it('transação anúncio + ação pendente é atômica', async () => {
    const t = openTestDb();
    await t.apply();
    const animals = new SqliteAnimalRepository(t.db);
    const queue = new SqliteSyncQueueRepository(t.db);
    try {
      await saveAnimalWithPendingAction(t.withTransaction, makeAnimal('anim_tx'), makeAction('q_tx', 'anim_tx'));
      expect(await animals.findById('anim_tx')).not.toBeNull();
      expect(await queue.findById('q_tx')).not.toBeNull();

      // Segunda tentativa reutiliza o id da ação (viola PK) → rollback total.
      await expect(
        saveAnimalWithPendingAction(t.withTransaction, makeAnimal('anim_tx2'), makeAction('q_tx', 'anim_tx2'))
      ).rejects.toThrow();
      expect(await animals.findById('anim_tx2')).toBeNull();
      expect((await queue.findById('q_tx'))?.entityId).toBe('anim_tx');
    } finally {
      closeTestDb(t);
    }
  });

  it('busca espelha a semântica do fake (filtros RF04 + texto + dono + status)', async () => {
    const t = openTestDb();
    await t.apply();
    const animals = new SqliteAnimalRepository(t.db);
    try {
      await animals.saveLocal(makeAnimal('a1'));
      await animals.saveLocal(makeAnimal('a2', { name: 'Mingau', species: 'Gato' }));
      const adopted = makeAnimal('a3', { name: 'Thor', city: 'Alfenas' });
      adopted.markAdopted('usr_1');
      await animals.saveLocal(adopted);

      expect((await animals.search({ species: 'cão' })).map((a) => a.id).sort()).toEqual(['a1', 'a3']);
      expect((await animals.search({ species: 'GATO' })).map((a) => a.id)).toEqual(['a2']);
      expect((await animals.search({ sex: 'macho' }))).toHaveLength(3);
      expect((await animals.search({ approximateAge: 'ANO' }))).toHaveLength(3);
      expect((await animals.search({ searchQuery: 'mingau' })).map((a) => a.id)).toEqual(['a2']);
      expect((await animals.search({ searchQuery: 'ALFENAS' })).map((a) => a.id)).toEqual(['a3']);
      expect((await animals.search({ ownerId: 'usr_1' }))).toHaveLength(3);
      expect((await animals.search({ status: 'ADOPTED' })).map((a) => a.id)).toEqual(['a3']);
      expect(await animals.search({ species: 'Coelho' })).toHaveLength(0);
      expect((await animals.listByOwner('usr_1'))).toHaveLength(3);
    } finally {
      closeTestDb(t);
    }
  });

  it('favoritos e interesses: CRUD de leitura local (Fase 2, escrita total é Fase 6)', async () => {
    const t = openTestDb();
    await t.apply();
    const favorites = new SqliteFavoriteRepository(t.db);
    const interests = new SqliteAdoptionInterestRepository(t.db);
    try {
      await favorites.addFavorite(new Favorite('usr_2', 'anim_1'));
      await favorites.addFavorite(new Favorite('usr_2', 'anim_1'));
      expect(await favorites.listByUser('usr_2')).toHaveLength(1);
      expect(await favorites.isFavorite('usr_2', 'anim_1')).toBe(true);
      await favorites.removeFavorite('usr_2', 'anim_1');
      expect(await favorites.isFavorite('usr_2', 'anim_1')).toBe(false);

      await interests.registerInterest(new AdoptionInterest('int_1', 'usr_2', 'anim_1'));
      expect(await interests.listByUser('usr_2')).toHaveLength(1);
      expect(await interests.listByAnimal('anim_1')).toHaveLength(1);
      expect(await interests.hasInterest('usr_2', 'anim_1')).toBe(true);
      expect(await interests.hasInterest('usr_9', 'anim_1')).toBe(false);
    } finally {
      closeTestDb(t);
    }
  });

  it('perfis (cache) e preferências: roundtrip', async () => {
    const t = openTestDb();
    await t.apply();
    const users = new SqliteUserRepository(t.db);
    const prefs = new SqliteSearchPreferencesRepository(t.db);
    try {
      await users.save(new User({ id: 'usr_1', name: 'Ana', contactInfo: new ContactInfo('ana@exemplo.com', '35999990000') }));
      expect((await users.findById('usr_1'))?.name).toBe('Ana');
      expect((await users.findByEmail('ANA@exemplo.com'))?.id).toBe('usr_1');
      expect(await users.findByEmail('ghost@exemplo.com')).toBeNull();

      expect(await prefs.get('usr_7')).toBeNull();
      await prefs.save('usr_7', new SearchPreferences({ species: 'Gato', distance: 10 }));
      const reloaded = await prefs.get('usr_7');
      expect(reloaded?.species).toBe('Gato');
      expect(reloaded?.distance).toBe(10);
      await prefs.clear('usr_7');
      expect(await prefs.get('usr_7')).toBeNull();
    } finally {
      closeTestDb(t);
    }
  });

  it('métodos remotos do repositório SQLite falham explícito (remoto é Fase 3/6)', async () => {
    const t = openTestDb();
    await t.apply();
    const animals = new SqliteAnimalRepository(t.db);
    try {
      await expect(animals.createRemote(makeAnimal('x'))).rejects.toThrow(/Fase 2/);
      await expect(animals.updateRemote(makeAnimal('x'))).rejects.toThrow(/Fase 2/);
      await expect(animals.deleteRemote('x')).rejects.toThrow(/Fase 2/);
    } finally {
      closeTestDb(t);
    }
  });
});
