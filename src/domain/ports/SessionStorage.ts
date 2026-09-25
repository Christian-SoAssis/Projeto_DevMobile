export interface SessionStorage {
  saveSessionToken(token: string): Promise<void>;
  getSessionToken(): Promise<string | null>;
  clearSession(): Promise<void>;
}
