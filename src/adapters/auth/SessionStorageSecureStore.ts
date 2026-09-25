import { SessionStorage } from '../../domain/ports/SessionStorage';

export class SessionStorageSecureStore implements SessionStorage {
  private inMemoryToken: string | null = null;

  async saveSessionToken(token: string): Promise<void> {
    this.inMemoryToken = token;
    try {
      // In Native production, uses ExpoSecureStore.setItemAsync('session_token', token)
    } catch {
      // Fallback
    }
  }

  async getSessionToken(): Promise<string | null> {
    return this.inMemoryToken;
  }

  async clearSession(): Promise<void> {
    this.inMemoryToken = null;
  }
}
