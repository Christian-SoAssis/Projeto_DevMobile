import {
  SearchPreferencesData,
  SearchPreferencesRepository,
} from '../../../../domain/ports/SearchPreferencesRepository';
import { SqliteDatabaseDriver } from '../DatabaseDriver';

interface SearchPreferencesRow {
  user_id: string;
  species: string | null;
  size: string | null;
  approximate_age: string | null;
  sex: string | null;
  search_query: string | null;
  radius_km: number | null;
  updated_at: string;
}

export class SqliteSearchPreferencesRepository implements SearchPreferencesRepository {
  constructor(private db: SqliteDatabaseDriver) {}

  async save(userId: string, prefs: SearchPreferencesData): Promise<void> {
    const updatedAt = new Date().toISOString();
    await this.db.runAsync(
      `INSERT INTO search_preferences (
        user_id, species, size, approximate_age, sex, search_query, radius_km, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        species = excluded.species,
        size = excluded.size,
        approximate_age = excluded.approximate_age,
        sex = excluded.sex,
        search_query = excluded.search_query,
        radius_km = excluded.radius_km,
        updated_at = excluded.updated_at`,
      [
        userId,
        prefs.species || null,
        prefs.size || null,
        prefs.approximateAge || null,
        prefs.sex || null,
        prefs.searchQuery || null,
        prefs.radiusKm ?? null,
        updatedAt,
      ]
    );
  }

  async findByUserId(userId: string): Promise<SearchPreferencesData | null> {
    const row = await this.db.getFirstAsync<SearchPreferencesRow>(
      `SELECT * FROM search_preferences WHERE user_id = ?`,
      [userId]
    );
    if (!row) return null;

    return {
      species: row.species || undefined,
      size: row.size || undefined,
      approximateAge: row.approximate_age || undefined,
      sex: row.sex || undefined,
      searchQuery: row.search_query || undefined,
      radiusKm: row.radius_km ?? undefined,
      updatedAt: row.updated_at,
    };
  }
}
