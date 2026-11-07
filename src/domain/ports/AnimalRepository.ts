import { Animal } from '../entities/Animal';

export interface AnimalFilterOptions {
  species?: string;
  size?: string;
  approximateAge?: string;
  sex?: string;
  searchQuery?: string;
  ownerId?: string;
  status?: string;
  /**
   * RF04 (distância): coordenada aproximada que define o CENTRO do raio
   * de pesquisa — capturada sob ação do usuário (§0.5, RF24). Sem origem
   * não há o que medir: o filtro de distância não entra.
   */
  origin?: { latitude: number; longitude: number };
  /**
   * RF04: raio de pesquisa em km, 0–10 (`SearchRadius`). 0 = sem raio
   * ativo (nenhum filtro de distância).
   */
  radiusKm?: number;
}

export interface AnimalRepository {
  findById(id: string): Promise<Animal | null>;
  search(filters: AnimalFilterOptions): Promise<Animal[]>;
  saveLocal(animal: Animal): Promise<void>;
  deleteLocal(id: string): Promise<void>;
  createRemote(animal: Animal): Promise<Animal>;
  updateRemote(animal: Animal): Promise<Animal>;
  deleteRemote(id: string): Promise<void>;
  listByOwner(ownerId: string): Promise<Animal[]>;
  upsertCache(animals: Animal[]): Promise<void>;
}
