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

export class SqliteSearchPreferencesRepository {
  constructor(private db: SqliteDatabaseDriver) {}

  async save(
    userId: string,
    prefs: {
      species?: string;
      size?: string;
      approximateAge?: string;
      sex?: string;
      searchQuery?: string;
      radiusKm?: number;
    }
  ): Promise<void> {
    const updatedAt = new Date().toISOString();
    const existing = await this.findByUserId(userId);

    if (existing) {
      await this.db.runAsync(
        `UPDATE search_preferences SET
          species = ?, size = ?, approximate_age = ?, sex = ?, search_query = ?, radius_km = ?, updated_at = ?
         WHERE user_id = ?`,
        [
          prefs.species || null,
          prefs.size || null,
          prefs.approximateAge || null,
          prefs.sex || null,
          prefs.searchQuery || null,
          prefs.radiusKm || null,
          updatedAt,
          userId,
        ]
      );
    } else {
      await this.db.runAsync(
        `INSERT INTO search_preferences (
          user_id, species, size, approximate_age, sex, search_query, radius_km, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          prefs.species || null,
          prefs.size || null,
          prefs.approximateAge || null,
          prefs.sex || null,
          prefs.searchQuery || null,
          prefs.radiusKm || null,
          updatedAt,
        ]
      );
    }
  }

  async findByUserId(userId: string): Promise<Record<string, unknown> | null> {
    const row = await this.db.getFirstAsync<SearchPreferencesRow>(
      `SELECT * FROM search_preferences WHERE user_id = ?`,
      [userId]
    );
    if (!row) return null;

    return {
      userId: row.user_id,
      species: row.species || undefined,
      size: row.size || undefined,
      approximateAge: row.approximate_age || undefined,
      sex: row.sex || undefined,
      searchQuery: row.search_query || undefined,
      radiusKm: row.radius_km || undefined,
      updatedAt: row.updated_at,
    };
  }
}
