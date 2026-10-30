import {
  SearchPreferencesData,
  SearchPreferencesRepository,
} from '../../domain/ports/SearchPreferencesRepository';

export class SearchPreferencesRepositoryFake implements SearchPreferencesRepository {
  public readonly items = new Map<string, SearchPreferencesData>();

  async save(userId: string, prefs: SearchPreferencesData): Promise<void> {
    this.items.set(userId, { ...prefs, updatedAt: new Date().toISOString() });
  }

  async findByUserId(userId: string): Promise<SearchPreferencesData | null> {
    return this.items.get(userId) || null;
  }
}
