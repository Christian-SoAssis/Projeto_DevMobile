import { UnitOfWork } from '../ports/UnitOfWork';

/** Implementação para fakes/testes que não precisam de transação real. */
export class NoopUnitOfWork implements UnitOfWork {
  async run<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}
