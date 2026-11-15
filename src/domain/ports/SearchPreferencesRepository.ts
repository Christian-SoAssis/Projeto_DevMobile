import { SearchPreferences } from '../entities/SearchPreferences';

export interface SearchPreferencesRepository {
  get(): Promise<SearchPreferences | null>;
  save(preferences: SearchPreferences): Promise<void>;
  clear(): Promise<void>;
}
