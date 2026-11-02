import { Animal } from '../entities/Animal';

/**
 * Leitura de anúncios no servidor (perna de "pull" da sincronização, doc §14.1).
 * Separado de `AnimalRepository` porque só existe com backend configurado.
 */
export interface RemoteAnimalSource {
  /** Anúncios visíveis (não ocultados pela moderação), com as fotos já enviadas. */
  listVisibleRemote(): Promise<Animal[]>;
  /** Versão atual de um anúncio no servidor, ou `null` se não existir mais. */
  findRemoteById(id: string): Promise<Animal | null>;
}
