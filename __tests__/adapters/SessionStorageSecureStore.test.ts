import { SessionStorageSecureStore, SESSION_TOKEN_KEY } from '../../src/adapters/auth/SessionStorageSecureStore';

/**
 * Fake determinístico de `expo-secure-store` (Keychain/Keystore): persiste
 * num Map, simulando o armazenamento que sobrevive a novas instâncias.
 */
function makeFakeSecureStore() {
  const map = new Map<string, string>();
  return {
    map,
    setItemAsync: async (key: string, value: string) => {
      map.set(key, value);
    },
    getItemAsync: async (key: string) => map.get(key) ?? null,
    deleteItemAsync: async (key: string) => {
      map.delete(key);
    },
  };
}

describe('SessionStorageSecureStore (expo-secure-store real: Keychain/Keystore)', () => {
  it('deve iniciar sem token', async () => {
    const store = new SessionStorageSecureStore({ secureStore: null });
    expect(await store.getSessionToken()).toBeNull();
  });

  it('deve salvar e ler o token em memória', async () => {
    const store = new SessionStorageSecureStore({ secureStore: null });
    await store.saveSessionToken('tok_123');
    expect(await store.getSessionToken()).toBe('tok_123');
  });

  it('deve sobrescrever o token anterior', async () => {
    const store = new SessionStorageSecureStore({ secureStore: null });
    await store.saveSessionToken('tok_1');
    await store.saveSessionToken('tok_2');
    expect(await store.getSessionToken()).toBe('tok_2');
  });

  it('deve limpar a sessão', async () => {
    const store = new SessionStorageSecureStore({ secureStore: null });
    await store.saveSessionToken('tok_123');
    await store.clearSession();
    expect(await store.getSessionToken()).toBeNull();
  });

  it('grava o token no store seguro com a chave do app', async () => {
    const fakeStore = makeFakeSecureStore();
    const store = new SessionStorageSecureStore({ secureStore: fakeStore });

    await store.saveSessionToken('tok_keystore');

    expect(fakeStore.map.get(SESSION_TOKEN_KEY)).toBe('tok_keystore');
  });

  it('uma sessão salva sobrevive a uma nova instância (reinício do app)', async () => {
    const fakeStore = makeFakeSecureStore();
    const primeiraAbertura = new SessionStorageSecureStore({ secureStore: fakeStore });
    await primeiraAbertura.saveSessionToken('tok_persistente');

    // "Reinício": nova instância sem token em memória, mesmo Keychain/Keystore.
    const segundaAbertura = new SessionStorageSecureStore({ secureStore: fakeStore });
    expect(await segundaAbertura.getSessionToken()).toBe('tok_persistente');
  });

  it('limpa o token persistido do store seguro', async () => {
    const fakeStore = makeFakeSecureStore();
    const store = new SessionStorageSecureStore({ secureStore: fakeStore });
    await store.saveSessionToken('tok_keystore');
    await store.clearSession();

    expect(fakeStore.map.has(SESSION_TOKEN_KEY)).toBe(false);
    expect(await store.getSessionToken()).toBeNull();
  });

  it('degrada para memória quando o store seguro lança erro — sem crash', async () => {
    const falhando = {
      setItemAsync: async () => {
        throw new Error('Keychain indisponível');
      },
      getItemAsync: async () => {
        throw new Error('Keychain indisponível');
      },
      deleteItemAsync: async () => {
        throw new Error('Keychain indisponível');
      },
    };
    const store = new SessionStorageSecureStore({ secureStore: falhando });

    await store.saveSessionToken('tok_falha');
    expect(await store.getSessionToken()).toBe('tok_falha');

    await store.clearSession();
    expect(await store.getSessionToken()).toBeNull();
  });

  it('construtor padrão usa require dinâmico e nunca explode em Jest', async () => {
    // Com jest-expo o módulo expo-secure-store vira mock; sem ponte nativa
    // real os métodos podem não persistir, mas o cache em memória garante a
    // leitura imediata de volta (contrato do use case de login).
    const store = new SessionStorageSecureStore();
    await store.saveSessionToken('tok_compat');
    expect(await store.getSessionToken()).toBe('tok_compat');
  });
});
