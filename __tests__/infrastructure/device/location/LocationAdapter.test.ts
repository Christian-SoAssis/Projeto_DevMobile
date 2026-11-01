import {
  ExpoLocationAdapter,
  LocationError,
  LocationPermissionDeniedError,
  LocationUnavailableError,
  LocationModule,
} from '../../../../src/infrastructure/device/location/LocationAdapter';

/**
 * Fake determinístico do módulo `expo-location` — expõe exatamente a forma
 * mínima consumida pelo adapter, com permissão, posição e geocodificação
 * configuráveis por teste.
 */
function buildFakeLocationModule(options: {
  granted?: boolean;
  coords?: { latitude: number; longitude: number };
  raiseReverse?: boolean;
  raisePosition?: boolean;
  chunks?: Array<{
    district?: string | null;
    subregion?: string | null;
    city?: string | null;
    region?: string | null;
  }>;
}): LocationModule {
  return {
    requestForegroundPermissionsAsync: async () => ({ granted: options.granted ?? true }),
    getCurrentPositionAsync: async () => {
      if (options.raisePosition) {
        throw new Error('GPS fault');
      }
      return { coords: options.coords ?? { latitude: -21.55432, longitude: -45.43571 } };
    },
    reverseGeocodeAsync: async () => {
      if (options.raiseReverse) {
        throw new Error('offline geocoder');
      }
      return (
        options.chunks ?? [
          { district: 'Centro', city: 'Varginha', region: 'Minas Gerais', subregion: 'Varginha' },
        ]
      );
    },
  };
}

describe('ExpoLocationAdapter — GPS real → coordenada aproximada no SQLite (RF24/RF25)', () => {
  it('captura a posição, anonimiza a coordenada e devolve o VO aproximado', async () => {
    // -21.55432 → -21.55 (2 casas) / -45.43571 → -45.44 (arredonda)
    const adapter = new ExpoLocationAdapter({
      locationModule: buildFakeLocationModule({
        coords: { latitude: -21.55432, longitude: -45.43571 },
      }),
    });

    const location = await adapter.getCurrentLocation();

    expect(location.latitude).toBe(-21.55);
    expect(location.longitude).toBe(-45.44);
    expect(location.city).toBe('Varginha');
    expect(location.neighborhood).toBe('Centro');
    expect(location.region).toBe('Minas Gerais');
    // A VO já devolve exatamente o formato que gravará no SQLite.
    expect(location.getApproximateCoordinates()).toEqual({
      latitudeApprox: -21.55,
      longitudeApprox: -45.44,
    });
  });

  it('não expõe rua nem número — lê apenas bairro/cidade/região (§15.2)', async () => {
    const spy = jest.fn().mockResolvedValue([
      {
        street: 'Rua Machado de Assis',
        streetNumber: '123',
        name: 'Casa',
        district: 'Centro',
        city: 'Varginha',
      },
    ]);
    const module = {
      ...buildFakeLocationModule({ }),
      reverseGeocodeAsync: spy,
    };
    const adapter = new ExpoLocationAdapter({ locationModule: module });

    const location = await adapter.getCurrentLocation();

    expect(spy).toHaveBeenCalledWith({ latitude: -21.55, longitude: -45.44 });
    expect(location.neighborhood).toBe('Centro');
    expect(JSON.stringify(location)).not.toContain('Machado de Assis');
    expect(JSON.stringify(location)).not.toContain('123');
  });

  it('permissão negada levanta LocationPermissionDeniedError (UC01-A3)', async () => {
    const adapter = new ExpoLocationAdapter({
      locationModule: buildFakeLocationModule({ granted: false }),
    });

    await expect(adapter.getCurrentLocation()).rejects.toBeInstanceOf(
      LocationPermissionDeniedError
    );
  });

  it('permissão que não responde (granted ausente) também nega', async () => {
    const module = buildFakeLocationModule({});
    module.requestForegroundPermissionsAsync = async () => ({
      granted: undefined as unknown as boolean,
    });
    const adapter = new ExpoLocationAdapter({ locationModule: module });

    await expect(adapter.getCurrentLocation()).rejects.toBeInstanceOf(
      LocationPermissionDeniedError
    );
  });

  it('falha no pedido de permissão é tratado como negação, sem crash', async () => {
    const module = buildFakeLocationModule({});
    module.requestForegroundPermissionsAsync = async () => {
      throw new Error('bridge error');
    };
    const adapter = new ExpoLocationAdapter({ locationModule: module });

    await expect(adapter.getCurrentLocation()).rejects.toBeInstanceOf(
      LocationPermissionDeniedError
    );
  });

  it('geocodificação indiponível/offline usa rótulos neutros sem quebrar (RNF05)', async () => {
    const adapter = new ExpoLocationAdapter({
      locationModule: buildFakeLocationModule({ raiseReverse: true }),
    });

    const location = await adapter.getCurrentLocation();

    expect(location.city).toBe('Cidade não identificada');
    expect(location.neighborhood).toBe('Bairro não identificado');
    expect(location.region).toBe('Região não identificada');
  });

  it('falha na própria posição do GPS levanta LocationError com mensagem clara', async () => {
    const adapter = new ExpoLocationAdapter({
      locationModule: buildFakeLocationModule({ raisePosition: true }),
    });

    await expect(adapter.getCurrentLocation()).rejects.toBeInstanceOf(LocationError);
  });

  it('coordenada inválida (NaN) é rejeitada, nada é gravado com lixo', async () => {
    const adapter = new ExpoLocationAdapter({
      locationModule: buildFakeLocationModule({
        coords: { latitude: Number.NaN, longitude: -45.4 },
      }),
    });

    await expect(adapter.getCurrentLocation()).rejects.toBeInstanceOf(LocationError);
  });

  it('sem módulo (Jest/demo) levanta LocationUnavailableError', async () => {
    // Caminho sem módulo injetado: expo-location não está instalado ainda,
    // e o require dinâmico cai no fallback `null`.
    const adapter = new ExpoLocationAdapter({ locationModule: null });

    await expect(adapter.getCurrentLocation()).rejects.toBeInstanceOf(LocationUnavailableError);
  });

  it('precisão de anonimização é configurável (bloqueador §4)', async () => {
    const preciseModule = new ExpoLocationAdapter({
      locationModule: buildFakeLocationModule({
        coords: { latitude: -21.55456, longitude: -45.43599 },
      }),
      coordinatesPrecision: 4,
    });
    const rounded4 = await preciseModule.getCurrentLocation();
    // 4 casas mantêm mais detalhe (~11 m) — valor deva ser confirmado no §4.
    expect(rounded4.latitude).toBe(-21.5546);

    const coarse = new ExpoLocationAdapter({
      locationModule: buildFakeLocationModule({
        coords: { latitude: -21.55456, longitude: -45.43599 },
      }),
      coordinatesPrecision: 1,
    });
    const rounded1 = await coarse.getCurrentLocation();
    // 1 casa ≈ 11 km — anonimização máxima do espectro proposto.
    expect(rounded1.latitude).toBe(-21.6);
  });
});
