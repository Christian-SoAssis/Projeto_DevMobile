import {
  OFFLINE_BEHAVIOR_LABELS,
  OFFLINE_CAPABILITIES,
  OFFLINE_STATUS_LABELS,
  getOfflineCapability,
  listOfflineCapabilities,
  OfflineBehavior,
  OfflineFeatureName,
} from '../../src/application/offline/OfflineCapabilities';

describe('OfflineCapabilities — mapeamento formal das funcionalidades offline', () => {
  const FEATURE_NAMES = Object.keys(OFFLINE_CAPABILITIES) as OfflineFeatureName[];

  it('cobre todas as funcionalidades do mapa offline (RNF01/RF17–RF22)', () => {
    const EXPECTED: OfflineFeatureName[] = [
      'busca_anuncios',
      'detalhes_anuncio',
      'meus_anuncios',
      'favoritos_listar',
      'favoritar_animal',
      'interesse_adocao',
      'criar_anuncio',
      'editar_anuncio',
      'excluir_anuncio',
      'marcar_adotado',
      'adicionar_foto',
      'fila_sincronizacao',
      'enviar_sincronizacao',
      'autenticacao',
    ];
    expect(FEATURE_NAMES.sort()).toEqual([...EXPECTED].sort());
    expect(FEATURE_NAMES.length).toBe(14);
  });

  it('todas as entradas têm rótulo, requisitos e fluxo offline documentados', () => {
    for (const name of FEATURE_NAMES) {
      const capability = getOfflineCapability(name);
      expect(capability.label.trim().length).toBeGreaterThan(0);
      expect(capability.rf.length).toBeGreaterThan(0);
      expect(capability.rf[0]).toMatch(/^RF\d+$/);
      expect(capability.offlineFlow.trim().length).toBeGreaterThan(0);
      expect(OFFLINE_BEHAVIOR_LABELS[capability.behavior]).toBeDefined();
    }
  });

  it('mutações de anúncio funcionam offline com fila (RF18/RF19)', () => {
    const QUEUE_BEHAVIORS: OfflineBehavior[] = ['OFFLINE_WITH_QUEUE'];
    for (const name of ['criar_anuncio', 'editar_anuncio', 'excluir_anuncio', 'marcar_adotado'] as OfflineFeatureName[]) {
      expect(getOfflineCapability(name).behavior).toBe(QUEUE_BEHAVIORS[0]);
    }
    expect(getOfflineCapability('adicionar_foto').behavior).toBe('OFFLINE_WITH_QUEUE');
  });

  it('consultas funcionam offline pelo cache (RF17) e envio/sessão exigem rede', () => {
    for (const name of ['busca_anuncios', 'detalhes_anuncio', 'meus_anuncios', 'favoritos_listar', 'fila_sincronizacao'] as OfflineFeatureName[]) {
      expect(getOfflineCapability(name).behavior).toBe('FULL_OFFLINE');
    }
    for (const name of ['enviar_sincronizacao', 'autenticacao'] as OfflineFeatureName[]) {
      expect(getOfflineCapability(name).behavior).toBe('ONLINE_ONLY');
    }
  });

  it('favoritos e interesses são OSCILANTES: local-only até decisão do §4', () => {
    expect(getOfflineCapability('favoritar_animal').behavior).toBe('OFFLINE_PARTIAL');
    expect(getOfflineCapability('interesse_adocao').behavior).toBe('OFFLINE_PARTIAL');
    expect(getOfflineCapability('favoritar_animal').offlineFlow).toContain('local-only');
  });

  it('lista para a UI mantém rótulos consistentes com o mapa', () => {
    const entries = listOfflineCapabilities();
    expect(entries).toHaveLength(14);
    for (const entry of entries) {
      expect(entry.behaviorLabel).toBe(
        OFFLINE_BEHAVIOR_LABELS[OFFLINE_CAPABILITIES[entry.feature].behavior]
      );
      expect(entry.label).toBe(OFFLINE_CAPABILITIES[entry.feature].label);
    }
  });

  it('RF22 — os cinco estados visuais inequívocos existem como constantes', () => {
    expect(Object.keys(OFFLINE_STATUS_LABELS).sort()).toEqual(
      ['OFFLINE', 'PENDING', 'SAVED', 'SYNCED', 'SYNCING'].sort()
    );
    expect(OFFLINE_STATUS_LABELS.OFFLINE).toContain('Modo Offline');
    expect(OFFLINE_STATUS_LABELS.SYNCED).toBe('Atualizado');
  });
});
