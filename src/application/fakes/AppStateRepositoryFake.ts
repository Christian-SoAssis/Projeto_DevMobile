import { AppStateRepository } from '../../domain/ports/AppStateRepository';

/** Chave/valor em memória — demo e testes (mesmo contrato do SQLite). */
export class AppStateRepositoryFake implements AppStateRepository {
  public store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
}
