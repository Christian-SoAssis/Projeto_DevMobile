/** @jest-environment node */
import { BetterSqliteDriver } from '../../../../test-support/BetterSqliteDriver';
import { applyMigrations } from '../../../../src/infrastructure/database/sqlite/migrations';
import { SqliteAppStateRepository } from '../../../../src/infrastructure/database/sqlite/repositories/SqliteAppStateRepository';
it('persists per-account read cutoffs across repository instances and supports upserts',async()=>{
 const db=new BetterSqliteDriver();
 try { await applyMigrations(db); const a=new SqliteAppStateRepository(db);
 expect(await a.get('u')).toBeNull(); await a.set('u','first'); await a.set('u','second');
 expect(await new SqliteAppStateRepository(db).get('u')).toBe('second'); expect(await a.get('other')).toBeNull();
 } finally { db.close(); }
});
