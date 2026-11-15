import { SearchPreferences } from '../../../../domain/entities/SearchPreferences';
import { SearchPreferencesRepository } from '../../../../domain/ports/SearchPreferencesRepository';
import { SqliteDatabaseDriver } from '../DatabaseDriver';

interface SearchPrefRow {
  id: string;
  species: string | null;
  size: string | null;
  approximate_age: string | null;
  sex: string | null;
  distance_km: number | null;
  region: string | null;
}

const DEFAULT_PREF_ID = 'current';

export class SqliteSearchPreferencesRepository implements SearchPreferencesRepository {
  constructor(private db: SqliteDatabaseDriver) {}

  async get(): Promise<SearchPreferences | null> {
    const row = await this.db.getFirstAsync<SearchPrefRow>(
      'SELECT * FROM search_preferences WHERE id = ?',
      [DEFAULT_PREF_ID]
    );
    if (!row) return null;
    return new SearchPreferences({
      species: row.species ?? undefined,
      size: row.size ?? undefined,
      approximateAge: row.approximate_age ?? undefined,
      sex: row.sex ?? undefined,
      distanceKm: row.distance_km !== null && row.distance_km !== undefined ? Number(row.distance_km) : undefined,
      region: row.region ?? undefined,
    });
  }

  async save(preferences: SearchPreferences): Promise<void> {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO search_preferences (
        id, species, size, approximate_age, sex, distance_km, region
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        DEFAULT_PREF_ID,
        preferences.species ?? null,
        preferences.size ?? null,
        preferences.approximateAge ?? null,
        preferences.sex ?? null,
        preferences.distanceKm ?? null,
        preferences.region ?? null,
      ]
    );
  }

  async clear(): Promise<void> {
    await this.db.runAsync('DELETE FROM search_preferences WHERE id = ?', [DEFAULT_PREF_ID]);
  }
}
