export interface ApproximateLocationProps {
  neighborhood: string;
  city: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  /** Indica se bairro/cidade/região vieram da geocodificação reversa (true) ou são valores padrão/falha (false). */
  geocoded?: boolean;
}

/**
 * Localização aproximada do animal/anunciante (RF24, RF25, RNF05, RNF06, D2, D8).
 * Nunca armazena nem expõe rua ou número residencial.
 * Coordenadas são arredondadas em 3 casas decimais (~110 m) para anonimização (Decisão D8).
 */
export class ApproximateLocation {
  public readonly neighborhood: string;
  public readonly city: string;
  public readonly region: string;
  public readonly latitude: number;
  public readonly longitude: number;
  public readonly geocoded: boolean;

  constructor(props: ApproximateLocationProps) {
    const city = (props.city ?? '').trim();
    const neighborhood = (props.neighborhood ?? '').trim();
    if (!city) {
      throw new Error('A cidade do anúncio é obrigatória.');
    }
    if (city.length > 60) {
      throw new Error('A cidade deve ter no máximo 60 caracteres.');
    }
    if (neighborhood.length > 60) {
      throw new Error('O bairro deve ter no máximo 60 caracteres.');
    }
    this.neighborhood = neighborhood || 'Centro';
    this.city = city;
    this.region = (props.region ?? 'MG').trim() || 'MG';
    this.latitude = ApproximateLocation.roundCoord(props.latitude ?? -21.55);
    this.longitude = ApproximateLocation.roundCoord(props.longitude ?? -45.43);
    this.geocoded = props.geocoded ?? false;
  }

  static roundCoord(value: number): number {
    if (typeof value !== 'number' || Number.isNaN(value)) return 0;
    return Math.round(value * 1000) / 1000;
  }

  /** Distância Haversine aproximada em km entre duas localizações. */
  distanceKmTo(lat: number, lon: number): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat - this.latitude);
    const dLon = toRad(lon - this.longitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(this.latitude)) *
        Math.cos(toRad(lat)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  }

  get displayLabel(): string {
    return `${this.neighborhood} • ${this.city}`;
  }
}
