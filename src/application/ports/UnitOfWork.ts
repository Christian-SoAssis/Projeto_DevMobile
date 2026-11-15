export interface UnitOfWork {
  runInTransaction<T>(work: () => Promise<T>): Promise<T>;
}
