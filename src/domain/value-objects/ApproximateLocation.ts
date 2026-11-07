export interface ApproximateLocationProps {
  latitude: number;
  longitude: number;
  neighborhood: string;
  city: string;
  region: string;
  timestamp?: string;
}

export class ApproximateLocation {
  readonly latitude: number;
  readonly longitude: number;
  readonly neighborhood: string;
  readonly city: string;
  readonly region: string;
  readonly timestamp: string;

  constructor(props: ApproximateLocationProps) {
    if (props.latitude < -90 || props.latitude > 90) {
      throw new Error('Latitude inválida. Deve estar entre -90 e 90.');
    }
    if (props.longitude < -180 || props.longitude > 180) {
      throw new Error('Longitude inválida. Deve estar entre -180 e 180.');
    }
    if (!props.city || props.city.trim().length === 0) {
      throw new Error('Cidade é obrigatória.');
    }
    if (!props.neighborhood || props.neighborhood.trim().length === 0) {
      throw new Error('Bairro/região é obrigatório.');
    }

    this.latitude = props.latitude;
    this.longitude = props.longitude;
    this.neighborhood = props.neighborhood.trim();
    this.city = props.city.trim();
    this.region = props.region?.trim() || props.city.trim();
    this.timestamp = props.timestamp || new Date().toISOString();
  }

  getApproximateCoordinates(): { latitudeApprox: number; longitudeApprox: number } {
    return {
      latitudeApprox: Math.round(this.latitude * 100) / 100,
      longitudeApprox: Math.round(this.longitude * 100) / 100,
    };
  }

  formatDisplayLocation(): string {
    return `${this.neighborhood}, ${this.city} - ${this.region}`;
  }

  equals(other: ApproximateLocation): boolean {
    return (
      this.latitude === other.latitude &&
      this.longitude === other.longitude &&
      this.neighborhood === other.neighborhood &&
      this.city === other.city
    );
  }

  /**
   * RF04 (distância): separação em km entre este ponto e outro, fórmula
   * de haversine sobre raio terrestre de 6371 km. Pura e determinística
   * — a regra de filtro mora no domínio; adapters e fakes apenas a aplicam.
   */
  distanceKmTo(target: { latitude: number; longitude: number }): number {
    return ApproximateLocation.distanceKmBetween(this, target);
  }

  static distanceKmBetween(
    a: { latitude: number; longitude: number },
    b: { latitude: number; longitude: number }
  ): number {
    const EARTH_RADIUS_KM = 6371;
    const toRad = (degrees: number) => (degrees * Math.PI) / 180;
    const deltaLat = toRad(b.latitude - a.latitude);
    const deltaLon = toRad(b.longitude - a.longitude);
    const half =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(deltaLon / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(half)));
  }
}
