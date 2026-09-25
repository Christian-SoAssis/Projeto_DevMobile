import { SessionStorageSecureStore } from '../../src/adapters/auth/SessionStorageSecureStore';

describe('SessionStorageSecureStore Adapter', () => {
  it('deve salvar, recuperar e limpar o token de sessão', async () => {
    const store = new SessionStorageSecureStore();
    expect(await store.getSessionToken()).toBeNull();

    await store.saveSessionToken('secure_token_123');
    expect(await store.getSessionToken()).toBe('secure_token_123');

    await store.clearSession();
    expect(await store.getSessionToken()).toBeNull();
  });
});
