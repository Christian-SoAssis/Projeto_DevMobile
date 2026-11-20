// Mock do expo-sqlite para testes
export const openDatabase = jest.fn(() => {
  const db: any = {
    execAsync: jest.fn(() => Promise.resolve()),
    runAsync: jest.fn(() => Promise.resolve({ changes: 0, lastInsertRowId: 0 })),
    getAllAsync: jest.fn(() => Promise.resolve([])),
    getFirstAsync: jest.fn(() => Promise.resolve(null)),
    close: jest.fn(() => Promise.resolve()),
    withTransactionAsync: jest.fn(async (task: () => Promise<unknown>) => task()),
  };
  return db;
});

export default { openDatabase };
