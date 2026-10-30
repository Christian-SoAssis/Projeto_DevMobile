export interface SearchPreferencesData {
  species?: string;
  size?: string;
  approximateAge?: string;
  sex?: string;
  searchQuery?: string;
  radiusKm?: number;
  updatedAt?: string;
}

export interface SearchPreferencesRepository {
  save(userId: string, prefs: SearchPreferencesData): Promise<void>;
  findByUserId(userId: string): Promise<SearchPreferencesData | null>;
}
