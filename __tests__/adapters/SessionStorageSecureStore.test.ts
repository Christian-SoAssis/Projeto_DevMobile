import { SessionStorageSecureStore } from '../../src/adapters/auth/SessionStorageSecureStore';

describe('SessionStorageSecureStore (mock Fase 1)', () => {
  it('deve iniciar sem token', async () => {
    const store = new SessionStorageSecureStore();
    expect(await store.getSessionToken()).toBeNull();
  });

  it('deve salvar e ler o token em memória', async () => {
    const store = new SessionStorageSecureStore();
    await store.saveSessionToken('tok_123');
    expect(await store.getSessionToken()).toBe('tok_123');
  });

  it('deve sobrescrever o token anterior', async () => {
    const store = new SessionStorageSecureStore();
    await store.saveSessionToken('tok_1');
    await store.saveSessionToken('tok_2');
    expect(await store.getSessionToken()).toBe('tok_2');
  });

  it('deve limpar a sessão', async () => {
    const store = new SessionStorageSecureStore();
    await store.saveSessionToken('tok_123');
    await store.clearSession();
    expect(await store.getSessionToken()).toBeNull();
  });
});
