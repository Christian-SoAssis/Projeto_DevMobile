import { LocationGateway } from '../../../domain/ports/LocationGateway';
import { ApproximateLocation } from '../../../domain/value-objects/ApproximateLocation';

export class LocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocationError';
  }
}

export class LocationPermissionDeniedError extends LocationError {
  constructor(message = 'Permissão de localização negada. Preencha o bairro e a cidade manualmente.') {
    super(message);
    this.name = 'LocationPermissionDeniedError';
  }
}

/**
 * Geolocalização pontual e aproximada (RF24, RF25, RNF05, RNF06).
 * Arredonda coordenadas em 2 casas decimais e consulta apenas bairro/cidade/região.
 */
export class ExpoLocationAdapter implements LocationGateway {
  private locationModule: any | null;

  constructor(options: { locationModule?: any | null } = {}) {
    if ('locationModule' in options) {
      this.locationModule = options.locationModule || null;
    } else {
      try {
        this.locationModule = require('expo-location');
      } catch {
        this.locationModule = null;
      }
    }
  }

  async getCurrentLocation(): Promise<ApproximateLocation> {
    if (!this.locationModule) {
      throw new LocationError('Módulo de localização indisponível neste dispositivo.');
    }

    const perm = await this.locationModule.requestForegroundPermissionsAsync();
    if (!perm?.granted) {
      throw new LocationPermissionDeniedError();
    }

    const pos = await this.locationModule.getCurrentPositionAsync({ accuracy: 3 });
    const lat = ApproximateLocation.roundCoord(pos?.coords?.latitude ?? -21.55);
    const lon = ApproximateLocation.roundCoord(pos?.coords?.longitude ?? -45.43);

    let neighborhood = 'Centro';
    let city = 'Varginha';
    let region = 'MG';

    try {
      const places = await this.locationModule.reverseGeocodeAsync({
        latitude: lat,
        longitude: lon,
      });
      const first = Array.isArray(places) ? places[0] : null;
      if (first) {
        neighborhood = first.district || first.subregion || first.city || 'Centro';
        city = first.city || first.subregion || 'Varginha';
        region = first.region || 'MG';
      }
    } catch {
      // mantém rótulos padrão caso geocodificação inversa falhe offline
    }

    return new ApproximateLocation({
      neighborhood,
      city,
      region,
      latitude: lat,
      longitude: lon,
    });
  }
}
