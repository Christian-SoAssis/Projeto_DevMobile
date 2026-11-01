import { LocationGateway } from '../../../domain/ports/LocationGateway';
import { ApproximateLocation } from '../../../domain/value-objects/ApproximateLocation';

/**
 * Forma mínima do módulo `expo-location`. O módulo é carregado dinamicamente
 * (não via import estático) para que o projeto compile e os testes rodem
 * mesmo sem a ponte nativa — mesmo padrão do `NetInfoConnectivityAdapter`.
 */
interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

interface LocationPermissionResult {
  granted: boolean;
  status?: string;
}

interface AddressChunk {
  district?: string | null;
  subregion?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
}

export interface LocationModule {
  requestForegroundPermissionsAsync(): Promise<LocationPermissionResult>;
  /**
   * `Location.getCurrentPositionAsync` — `accuracy` numérica idêntica ao
   * enum do expo-location (3 = `Accuracy.Balanced`).
   */
  getCurrentPositionAsync(options?: { accuracy?: number }): Promise<{
    coords: LocationCoordinates;
  }>;
  /** `Location.reverseGeocodeAsync` — usado apenas para bairro/cidade (§15.2). */
  reverseGeocodeAsync(location: { latitude: number; longitude: number }): Promise<AddressChunk[]>;
}

export interface ExpoLocationAdapterOptions {
  /** Módulo injetado (testes). `null` força o caminho "sem módulo". */
  locationModule?: LocationModule | null;
  /**
   * Casas decimais mantidas na coordenada persistida. 2 casas (~1,1 km)
   * é o valor padrão **proposto**; a precisão final é decisão do §4
   * ("precisão de anonimização de coordenadas").
   */
  coordinatesPrecision?: number;
}

export class LocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocationError';
  }
}

/** UC01-A3 / RF24: permissão negada não pode quebrar o fluxo do usuário. */
export class LocationPermissionDeniedError extends LocationError {
  constructor(message = 'Permissão de localização negada. Preencha o local manualmente.') {
    super(message);
    this.name = 'LocationPermissionDeniedError';
  }
}

export class LocationUnavailableError extends LocationError {
  constructor(message = 'Módulo de localização indisponível neste ambiente.') {
    super(message);
    this.name = 'LocationUnavailableError';
  }
}

const FALLBACK_NEIGHBORHOOD = 'Bairro não identificado';
const FALLBACK_CITY = 'Cidade não identificada';
const FALLBACK_REGION = 'Região não identificada';

/**
 * Adapter de geolocalização real do dispositivo (RF05, RF24, RF25).
 *
 * Regras de privacidade obrigatórias (RNF05/RNF06, §0.5 e §15.2):
 * - a coordenada é capturada **somente** sob ação do usuário ou no fluxo de
 *   criação do anúncio (nunca em segundo plano);
 * - a coordenada é anonimizada (arredondada) antes de persistir no SQLite;
 * - a geocodificação inversa é usada **apenas** para bairro/cidade/região —
 *   rua e número nunca são lidos.
 */
export class ExpoLocationAdapter implements LocationGateway {
  private locationModule: LocationModule | null;
  private coordinatesPrecision: number;

  constructor(options: ExpoLocationAdapterOptions = {}) {
    this.coordinatesPrecision = options.coordinatesPrecision ?? 2;

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
      throw new LocationUnavailableError();
    }

    let permission: LocationPermissionResult | undefined;
    try {
      permission = await this.locationModule.requestForegroundPermissionsAsync();
    } catch {
      throw new LocationPermissionDeniedError();
    }
    if (!permission || permission.granted !== true) {
      throw new LocationPermissionDeniedError();
    }

    let position;
    try {
      position = await this.locationModule.getCurrentPositionAsync({ accuracy: 3 });
    } catch {
      throw new LocationError('Não foi possível obter a posição atual do GPS.');
    }

    const coords = position?.coords;
    if (
      !coords ||
      typeof coords.latitude !== 'number' ||
      typeof coords.longitude !== 'number' ||
      Number.isNaN(coords.latitude) ||
      Number.isNaN(coords.longitude)
    ) {
      throw new LocationError('Coordenada inválida recebida do GPS.');
    }

    // Anonimização: arredonda antes de construir o VO/persistir no SQLite.
    const latitude = this.round(coords.latitude);
    const longitude = this.round(coords.longitude);

    const place = await this.resolvePlace(latitude, longitude);

    return new ApproximateLocation({
      latitude,
      longitude,
      neighborhood: place.neighborhood,
      city: place.city,
      region: place.region,
    });
  }

  private async resolvePlace(
    latitude: number,
    longitude: number
  ): Promise<{ neighborhood: string; city: string; region: string }> {
    let chunks: AddressChunk[] | null = null;
    try {
      chunks = await this.locationModule!.reverseGeocodeAsync({ latitude, longitude });
    } catch {
      // Sem internet/geocodificador: segue com os rótulos neutros abaixo.
    }

    const chunk = Array.isArray(chunks) && chunks.length > 0 ? chunks[0] : null;
    const city =
      chunk?.city || chunk?.subregion || chunk?.region || null;
    const neighborhood = chunk?.district || chunk?.subregion || chunk?.city || null;
    const region = chunk?.region || chunk?.country || null;

    return {
      neighborhood: neighborhood || FALLBACK_NEIGHBORHOOD,
      city: city || FALLBACK_CITY,
      region: region || FALLBACK_REGION,
    };
  }

  private round(value: number): number {
    const factor = Math.pow(10, this.coordinatesPrecision);
    return Math.round(value * factor) / factor;
  }
}
