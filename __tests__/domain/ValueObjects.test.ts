import { ApproximateLocation } from '../../src/domain/value-objects/ApproximateLocation';
import { AdoptionStatus } from '../../src/domain/value-objects/AdoptionStatus';
import { SyncState } from '../../src/domain/value-objects/SyncState';
import { AnimalCharacteristics } from '../../src/domain/value-objects/AnimalCharacteristics';
import { ContactInfo } from '../../src/domain/value-objects/ContactInfo';
import { SearchPreferences } from '../../src/domain/value-objects/SearchPreferences';

describe('Domain Value Objects', () => {
  describe('ApproximateLocation', () => {
    it('deve criar uma localização válida e calcular coordenadas aproximadas', () => {
      const loc = new ApproximateLocation({
        latitude: -21.554321,
        longitude: -45.435678,
        neighborhood: 'Centro',
        city: 'Varginha',
        region: 'MG',
      });
      expect(loc.latitude).toBe(-21.554321);
      const approx = loc.getApproximateCoordinates();
      expect(approx.latitudeApprox).toBe(-21.55);
      expect(approx.longitudeApprox).toBe(-45.44);
      expect(loc.formatDisplayLocation()).toBe('Centro, Varginha - MG');
    });

    it('deve lançar erro para latitude inválida', () => {
      expect(() => {
        new ApproximateLocation({
          latitude: 100,
          longitude: -45.4,
          neighborhood: 'Centro',
          city: 'Varginha',
          region: 'MG',
        });
      }).toThrow('Latitude inválida');
    });

    it('deve lançar erro para longitude inválida', () => {
      expect(() => {
        new ApproximateLocation({
          latitude: 0,
          longitude: -200,
          neighborhood: 'Centro',
          city: 'Varginha',
          region: 'MG',
        });
      }).toThrow('Longitude inválida');
    });

    it('deve lançar erro quando cidade ou bairro forem vazios', () => {
      expect(() => {
        new ApproximateLocation({
          latitude: 0,
          longitude: 0,
          neighborhood: '',
          city: 'Varginha',
          region: 'MG',
        });
      }).toThrow('Bairro/região é obrigatório.');

      expect(() => {
        new ApproximateLocation({
          latitude: 0,
          longitude: 0,
          neighborhood: 'Centro',
          city: '',
          region: 'MG',
        });
      }).toThrow('Cidade é obrigatória.');
    });

    it('deve comparar igualdade entre duas localizações', () => {
      const loc1 = new ApproximateLocation({ latitude: 10, longitude: 20, neighborhood: 'A', city: 'B', region: 'C' });
      const loc2 = new ApproximateLocation({ latitude: 10, longitude: 20, neighborhood: 'A', city: 'B', region: 'C' });
      expect(loc1.equals(loc2)).toBe(true);
    });
  });

  describe('AdoptionStatus', () => {
    it('deve criar status disponível e adotado corretamente', () => {
      const av = AdoptionStatus.available();
      expect(av.isAvailable()).toBe(true);
      expect(av.isAdopted()).toBe(false);

      const ad = AdoptionStatus.adopted();
      expect(ad.isAdopted()).toBe(true);
    });

    it('deve lançar erro para valor inválido', () => {
      expect(() => new AdoptionStatus('INVALID' as any)).toThrow();
    });
  });

  describe('SyncState', () => {
    it('deve mapear status e alternar métodos utilitários', () => {
      expect(SyncState.pending().isPending()).toBe(true);
      expect(SyncState.syncing().isSyncing()).toBe(true);
      expect(SyncState.failed().isFailed()).toBe(true);
      expect(SyncState.completed().isCompleted()).toBe(true);

      const s1 = new SyncState('pending');
      expect(s1.isPending()).toBe(true);
      const s2 = new SyncState('synced');
      expect(s2.isCompleted()).toBe(true);
      const s3 = new SyncState('error');
      expect(s3.isFailed()).toBe(true);
    });

    it('deve lançar erro para status de sincronização inválido', () => {
      expect(() => new SyncState('unknown' as any)).toThrow();
    });
  });

  describe('AnimalCharacteristics', () => {
    it('deve instanciar características válidas', () => {
      const c = new AnimalCharacteristics({
        species: 'Cão',
        size: 'Médio',
        approximateAge: '2 anos',
        sex: 'Fêmea',
      });
      expect(c.summary()).toBe('Cão • Médio • 2 anos • Fêmea');
      expect(c.specialCare).toBe('Nenhum');
    });

    it('deve lançar erro se campos obrigatórios forem vazios', () => {
      expect(() => new AnimalCharacteristics({ species: '', size: 'M', approximateAge: '1', sex: 'M' })).toThrow();
      expect(() => new AnimalCharacteristics({ species: 'Cão', size: '', approximateAge: '1', sex: 'M' })).toThrow();
      expect(() => new AnimalCharacteristics({ species: 'Cão', size: 'M', approximateAge: '', sex: 'M' })).toThrow();
      expect(() => new AnimalCharacteristics({ species: 'Cão', size: 'M', approximateAge: '1', sex: '' })).toThrow();
    });
  });

  describe('ContactInfo', () => {
    it('deve validar formato de e-mail', () => {
      const ci = new ContactInfo('teste@exemplo.com', '11999998888');
      expect(ci.email).toBe('teste@exemplo.com');
      expect(ci.phone).toBe('11999998888');

      expect(() => new ContactInfo('email_invalido')).toThrow();
    });
  });

  describe('SearchPreferences', () => {
    it('deve iniciar vazio quando nenhum filtro é informado', () => {
      const prefs = new SearchPreferences();
      expect(prefs.isEmpty()).toBe(true);
    });

    it('deve armazenar filtros sem impor limites (limites são decisão de produto)', () => {
      const prefs = new SearchPreferences({
        species: 'Cão',
        size: 'Médio',
        age: '2 anos',
        sex: 'Fêmea',
        distance: 50,
        region: 'MG',
      });

      expect(prefs.isEmpty()).toBe(false);
      expect(prefs.species).toBe('Cão');
      expect(prefs.distance).toBe(50);
      expect(prefs.region).toBe('MG');
    });
  });
});
