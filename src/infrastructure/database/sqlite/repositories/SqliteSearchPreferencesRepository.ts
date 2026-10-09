import { eq } from 'drizzle-orm';
import type { SearchPreferences } from '../../../../domain/value-objects/SearchPreferences';
import type { SearchPreferencesRepository } from '../../../../domain/ports/SearchPreferencesRepository';
import type { AppDatabase } from '../connection';
import { searchPreferences } from '../schema';
import { prefsToRow, rowToPrefs } from '../mappers';

export class SqliteSearchPreferencesRepository implements SearchPreferencesRepository {
  constructor(private readonly db: AppDatabase) {}

  async get(userId: string): Promise<SearchPreferences | null> {
    const rows = await this.db
      .select()
      .from(searchPreferences)
      .where(eq(searchPreferences.userId, userId))
      .limit(1);
    return rows.length === 0 ? null : rowToPrefs(rows[0]);
  }

  async save(userId: string, preferences: SearchPreferences): Promise<void> {
    const row = prefsToRow(userId, preferences);
    const { userId: _ignored, ...updatable } = row;
    await this.db
      .insert(searchPreferences)
      .values(row)
      .onConflictDoUpdate({ target: searchPreferences.userId, set: updatable });
  }

  async clear(userId: string): Promise<void> {
    await this.db.delete(searchPreferences).where(eq(searchPreferences.userId, userId));
  }
}
