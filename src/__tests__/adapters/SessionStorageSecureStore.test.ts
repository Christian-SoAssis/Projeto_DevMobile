import { SessionStorageSecureStore } from '../../adapters/auth/SessionStorageSecureStore';

describe('SessionStorageSecureStore', () => {
  let storage: SessionStorageSecureStore;

  beforeEach(() => {
    storage = new SessionStorageSecureStore();
  });

  afterEach(() => {
    storage.clear();
  });

  it('deve salvar e recuperar um item', async () => {
    await storage.setItem('chave-1', 'valor-1');
    const valor = await storage.getItem('chave-1');
    expect(valor).toBe('valor-1');
  });

  it('deve retornar null para chave inexistente', async () => {
    const valor = await storage.getItem('chave-inexistente');
    expect(valor).toBeNull();
  });

  it('deve sobrescrever valor existente', async () => {
    await storage.setItem('chave-1', 'valor-antigo');
    await storage.setItem('chave-1', 'valor-novo');
    const valor = await storage.getItem('chave-1');
    expect(valor).toBe('valor-novo');
  });

  it('deve remover um item', async () => {
    await storage.setItem('chave-1', 'valor-1');
    await storage.removeItem('chave-1');
    const valor = await storage.getItem('chave-1');
    expect(valor).toBeNull();
  });

  it('deve sanitizar chaves com caracteres especiais', async () => {
    await storage.setItem('chave/com@caracteres', 'valor-sanitizado');
    const valor = await storage.getItem('chave/com@caracteres');
    expect(valor).toBe('valor-sanitizado');
  });

  it('deve rastrear tamanho do armazenamento em memória', async () => {
    expect(storage.size).toBe(0);
    await storage.setItem('a', '1');
    await storage.setItem('b', '2');
    expect(storage.size).toBe(2);
    await storage.removeItem('a');
    expect(storage.size).toBe(1);
  });

  it('deve limpar todo o armazenamento', async () => {
    await storage.setItem('a', '1');
    await storage.setItem('b', '2');
    storage.clear();
    expect(await storage.getItem('a')).toBeNull();
    expect(await storage.getItem('b')).toBeNull();
    expect(storage.size).toBe(0);
  });

  it('deve verificar existência de chave', async () => {
    expect(storage.has('qualquer')).toBe(false);
    await storage.setItem('qualquer', 'valor');
    expect(storage.has('qualquer')).toBe(true);
  });

  it('deve recuperar valor bruto sem sanitização de retorno', async () => {
    await storage.setItem('chave-teste', 'valor-bruto');
    const raw = storage.getRaw('chave-teste');
    expect(raw).toBe('valor-bruto');
  });

  it('deve fragmentar em chunks sessões maiores que o limite de 2 KB do SecureStore', async () => {
    const nativeStore = new Map<string, string>();
    const mockSecureStore = {
      setItemAsync: jest.fn(async (key: string, value: string) => {
        if (value.length > 2048) {
          throw new Error('Value to store is larger than 2048 bytes');
        }
        nativeStore.set(key, value);
      }),
      getItemAsync: jest.fn(async (key: string) => nativeStore.get(key) ?? null),
      deleteItemAsync: jest.fn(async (key: string) => {
        nativeStore.delete(key);
      }),
    };

    const chunkedStorage = new SessionStorageSecureStore(mockSecureStore);
    const largeSession = JSON.stringify({
      access_token: 'a'.repeat(2200),
      refresh_token: 'b'.repeat(2200),
      user: { id: 'user-1', email: 'test@example.com' },
    });

    await chunkedStorage.setItem('sb-auth-token', largeSession);

    // O manifesto e os 3 chunks foram salvos no SecureStore sem exceder 2048 bytes cada
    expect(nativeStore.get('sb-auth-token')).toBe('__chunked__:3');
    expect(nativeStore.has('sb-auth-token__chunk_0')).toBe(true);
    expect(nativeStore.has('sb-auth-token__chunk_1')).toBe(true);
    expect(nativeStore.has('sb-auth-token__chunk_2')).toBe(true);

    // Simula reinício do app (nova instância lendo apenas do SecureStore nativo)
    const restartedStorage = new SessionStorageSecureStore(mockSecureStore);
    const restored = await restartedStorage.getItem('sb-auth-token');
    expect(restored).toBe(largeSession);

    // Ao remover, limpa manifesto e todos os chunks
    await restartedStorage.removeItem('sb-auth-token');
    expect(nativeStore.size).toBe(0);
  });
});
