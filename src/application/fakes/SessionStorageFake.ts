import { SessionStorage } from '../../domain/ports/SessionStorage';

export class SessionStorageFake implements SessionStorage {
  private token: string | null = null;

  async saveSessionToken(token: string): Promise<void> {
    this.token = token;
  }

  async getSessionToken(): Promise<string | null> {
    return this.token;
  }

  async clearSession(): Promise<void> {
    this.token = null;
  }
}
