import { UnitOfWork } from '../../../application/ports/UnitOfWork';
import { SqliteDatabaseDriver } from './DatabaseDriver';

export class SqliteUnitOfWork implements UnitOfWork {
  constructor(private db: SqliteDatabaseDriver) {}

  runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    return this.db.withTransactionAsync(work);
  }
}
