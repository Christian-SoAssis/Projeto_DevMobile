/**
 * Fronteira transacional da aplicação.
 *
 * Casos de uso que precisam gravar mais de uma estrutura local (por exemplo,
 * anúncio + ação na fila) recebem este port em vez de conhecer SQLite.
 */
export interface UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T>;
}
