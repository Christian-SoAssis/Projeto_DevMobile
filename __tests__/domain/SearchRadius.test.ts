import {
  MAX_SEARCH_RADIUS_KM,
  MIN_SEARCH_RADIUS_KM,
  SearchRadius,
  InvalidSearchRadiusError,
} from '../../src/domain/value-objects/SearchRadius';

/**
 * Decisão de produto (§19): RAIO MÁXIMO DE PESQUISA = 10 km (RF04). Sem
 * teto, o filtro "por raio" degeneraria em busca sem abrangência definida.
 */
describe('SearchRadius (raio máximo de pesquisa)', () => {
  it('aceita raio no limite superior de 10 km e normaliza casas decimais', () => {
    expect(new SearchRadius(MAX_SEARCH_RADIUS_KM).valueKm).toBe(10);
    expect(new SearchRadius(4.56).valueKm).toBe(4.6);
  });

  it('aceita 0 km (sem raio ativo) e valores intermediários', () => {
    expect(new SearchRadius(MIN_SEARCH_RADIUS_KM).valueKm).toBe(0);
    expect(new SearchRadius(3).valueKm).toBe(3);
  });

  it('recusa valor acima do máximo de 10 km', () => {
    expect(() => new SearchRadius(10.1)).toThrow(InvalidSearchRadiusError);
    expect(() => new SearchRadius(15)).toThrow('O raio de pesquisa deve ficar entre 0 e 10 km.');
  });

  it('recusa negativos, NaN e Infinity', () => {
    expect(() => new SearchRadius(-1)).toThrow(InvalidSearchRadiusError);
    expect(() => new SearchRadius(NaN)).toThrow('O raio de pesquisa deve ser um número em quilômetros.');
    expect(() => new SearchRadius(Infinity)).toThrow(InvalidSearchRadiusError);
  });

  it('from() ignora valores ausentes e valida os presentes', () => {
    expect(SearchRadius.from(undefined)).toBeUndefined();
    expect(SearchRadius.from(2)?.valueKm).toBe(2);
    expect(() => SearchRadius.from(11) as never).toThrow(InvalidSearchRadiusError);
  });
});
