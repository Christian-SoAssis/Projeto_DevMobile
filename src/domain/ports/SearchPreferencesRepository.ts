import { SearchPreferences } from '../value-objects/SearchPreferences';

export interface SearchPreferencesRepository {
  get(userId: string): Promise<SearchPreferences | null>;
  save(userId: string, preferences: SearchPreferences): Promise<void>;
  clear(userId: string): Promise<void>;
}
