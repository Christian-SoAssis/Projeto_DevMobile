import { ExpoSqliteDriver } from '../../../src/infrastructure/database/sqlite/DatabaseDriver';

class FakeExpoDatabase {
  public statements: string[] = [];
  public runResult = { changes: 1, lastInsertRowId: 42 };
  public failBegin = false;

  async execAsync(sql: string): Promise<void> {
    this.statements.push(sql);
    if (sql === 'BEGIN' && this.failBegin) {
      throw new Error('BEGIN falhou');
    }
  }

  async runAsync(): Promise<{ changes: number; lastInsertRowId?: number }> {
    return this.runResult;
  }

  async getFirstAsync<T>(): Promise<T | null> {
    return { id: 'row' } as unknown as T;
  }

  async getAllAsync<T>(): Promise<T[]> {
    return [{ id: 'row' }] as unknown as T[];
  }
}

describe('ExpoSqliteDriver — adaptação e transações', () => {
  it('delega operações e normaliza o resultado de runAsync', async () => {
    const raw = new FakeExpoDatabase();
    const driver = new ExpoSqliteDriver(raw as any);

    await driver.execAsync('PRAGMA foreign_keys = ON');
    await expect(driver.runAsync('UPDATE t SET a = ?', [1])).resolves.toEqual({
      changes: 1,
      lastInsertRowId: 42,
    });
    expect(await driver.getFirstAsync('SELECT 1')).toEqual({ id: 'row' });
    expect(await driver.getAllAsync('SELECT 1')).toEqual([{ id: 'row' }]);
    expect(raw.statements).toContain('PRAGMA foreign_keys = ON');
  });

  it('faz COMMIT no sucesso e ROLLBACK no erro', async () => {
    const raw = new FakeExpoDatabase();
    const driver = new ExpoSqliteDriver(raw as any);

    await driver.withTransactionAsync(async () => 'ok');
    expect(raw.statements).toEqual(['BEGIN', 'COMMIT']);

    raw.statements = [];
    await expect(
      driver.withTransactionAsync(async () => {
        throw new Error('falha');
      })
    ).rejects.toThrow('falha');
    expect(raw.statements).toEqual(['BEGIN', 'ROLLBACK']);
  });

  it('transação aninhada participa da externa sem BEGIN duplicado', async () => {
    const raw = new FakeExpoDatabase();
    const driver = new ExpoSqliteDriver(raw as any);

    await driver.withTransactionAsync(async () => {
      await driver.withTransactionAsync(async () => 'interno');
    });

    expect(raw.statements).toEqual(['BEGIN', 'COMMIT']);
  });

  it('recupera a profundidade transacional quando o BEGIN falha', async () => {
    const raw = new FakeExpoDatabase();
    const driver = new ExpoSqliteDriver(raw as any);
    raw.failBegin = true;

    await expect(driver.withTransactionAsync(async () => 'x')).rejects.toThrow('BEGIN falhou');
    expect(raw.statements).toEqual(['BEGIN']);

    // Se a profundidade não fosse restaurada, a próxima chamada não emitiria
    // BEGIN novamente.
    raw.failBegin = false;
    raw.statements = [];
    await driver.withTransactionAsync(async () => 'x');
    expect(raw.statements).toEqual(['BEGIN', 'COMMIT']);
  });
});
