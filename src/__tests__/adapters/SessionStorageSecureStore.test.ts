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
});
