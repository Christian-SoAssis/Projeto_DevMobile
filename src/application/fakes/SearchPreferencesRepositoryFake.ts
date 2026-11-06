import {
  SearchPreferencesData,
  SearchPreferencesRepository,
} from '../../domain/ports/SearchPreferencesRepository';
import { SearchRadius } from '../../domain/value-objects/SearchRadius';

export class SearchPreferencesRepositoryFake implements SearchPreferencesRepository {
  public readonly items = new Map<string, SearchPreferencesData>();

  async save(userId: string, prefs: SearchPreferencesData): Promise<void> {
    // Mesma validação do driver real: raio fora de 0–10 km é recusado.
    SearchRadius.from(prefs.radiusKm);
    this.items.set(userId, { ...prefs, updatedAt: new Date().toISOString() });
  }

  async findByUserId(userId: string): Promise<SearchPreferencesData | null> {
    return this.items.get(userId) || null;
  }
}
