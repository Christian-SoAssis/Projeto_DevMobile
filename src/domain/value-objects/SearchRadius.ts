export const MAX_SEARCH_RADIUS_KM = 10;

/**
 * Decisão 14 (RF04): raio máximo de pesquisa = 10 km.
 * Preferências fora de 0–10 km são recusadas.
 */
export class SearchRadius {
  public readonly km: number;

  constructor(km: number) {
    if (typeof km !== 'number' || Number.isNaN(km) || km < 0 || km > MAX_SEARCH_RADIUS_KM) {
      throw new Error(`O raio de pesquisa deve estar entre 0 e ${MAX_SEARCH_RADIUS_KM} km.`);
    }
    this.km = km;
  }
}
