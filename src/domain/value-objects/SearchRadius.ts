/**
 * Decisão de produto (§19): o raio de pesquisa por distância (RF04) tem
 * MÁXIMO de 10 km. Sem teto, "raio" degenera em busca sem filtro — o
 * produto quer descoberta local, nunca abrangência ilimitada.
 */
export const MAX_SEARCH_RADIUS_KM = 10;
export const MIN_SEARCH_RADIUS_KM = 0;

export class InvalidSearchRadiusError extends Error {
  constructor(msg = `O raio de pesquisa deve ficar entre ${MIN_SEARCH_RADIUS_KM} e ${MAX_SEARCH_RADIUS_KM} km.`) {
    super(msg);
    this.name = 'InvalidSearchRadiusError';
  }
}

export class SearchRadius {
  readonly valueKm: number;

  constructor(radiusKm: number) {
    if (typeof radiusKm !== 'number' || !Number.isFinite(radiusKm)) {
      throw new InvalidSearchRadiusError('O raio de pesquisa deve ser um número em quilômetros.');
    }
    if (radiusKm < MIN_SEARCH_RADIUS_KM || radiusKm > MAX_SEARCH_RADIUS_KM) {
      throw new InvalidSearchRadiusError();
    }
    // Uma casa decimal basta (100 m) e evita lixo de ponto flutuante no banco.
    this.valueKm = Math.round(radiusKm * 10) / 10;
  }

  /** Normaliza um valor opcional: ausente/abaixo do mínimo é desconsiderado (sem filtro). */
  static from(radiusKm?: number): SearchRadius | undefined {
    if (radiusKm === undefined || radiusKm === null) return undefined;
    return new SearchRadius(radiusKm);
  }

  valueOf(): number {
    return this.valueKm;
  }
}
