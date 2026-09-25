import { ApproximateLocation } from '../../src/domain/value-objects/ApproximateLocation';
import { AdoptionStatus } from '../../src/domain/value-objects/AdoptionStatus';
import { SyncState } from '../../src/domain/value-objects/SyncState';
import { AnimalCharacteristics } from '../../src/domain/value-objects/AnimalCharacteristics';
import { Criterio } from '../../src/domain/value-objects/Criterio';
import { Assinatura } from '../../src/domain/value-objects/Assinatura';
import { CargaHoraria } from '../../src/domain/value-objects/CargaHoraria';
import { StatusPeriodo } from '../../src/domain/value-objects/StatusPeriodo';
import { ContactInfo } from '../../src/domain/value-objects/ContactInfo';

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

  describe('Criterio', () => {
    it('deve calcular a faixa de notas corretamente (MB, B, R, F)', () => {
      expect(new Criterio('Assiduidade', 9.5).getFaixa()).toBe('MB');
      expect(new Criterio('Assiduidade', 8.0).getFaixa()).toBe('B');
      expect(new Criterio('Assiduidade', 6.0).getFaixa()).toBe('R');
      expect(new Criterio('Assiduidade', 4.0).getFaixa()).toBe('F');
    });

    it('deve validar nome e limites de nota (0-10)', () => {
      expect(() => new Criterio('', 8)).toThrow();
      expect(() => new Criterio('Pontualidade', -1)).toThrow();
      expect(() => new Criterio('Pontualidade', 11)).toThrow();
    });
  });

  describe('Assinatura', () => {
    it('deve validar dados base64 e ID do responsável', () => {
      const ass = new Assinatura('data:image/png;base64,123456789012', 'resp_1');
      expect(ass.isValid()).toBe(true);
      expect(ass.responsavelId).toBe('resp_1');

      expect(() => new Assinatura('', 'resp_1')).toThrow();
      expect(() => new Assinatura('data', '')).toThrow();
    });
  });

  describe('CargaHoraria', () => {
    it('deve calcular atendimento às horas mínimas', () => {
      const ch = new CargaHoraria(100, 40, 50);
      expect(ch.isAtendida()).toBe(true);

      const ch2 = new CargaHoraria(100, 40, 30);
      expect(ch2.isAtendida()).toBe(false);
    });

    it('deve validar limites de horas', () => {
      expect(() => new CargaHoraria(-1, 10, 5)).toThrow();
      expect(() => new CargaHoraria(50, 20, 60)).toThrow();
    });
  });

  describe('StatusPeriodo', () => {
    it('deve criar status válidos', () => {
      const st = new StatusPeriodo('APROVADO');
      expect(st.isAprovado()).toBe(true);
      expect(new StatusPeriodo('RASCUNHO').isRascunho()).toBe(true);
      expect(new StatusPeriodo('DEVOLVIDO').isDevolvido()).toBe(true);
    });

    it('deve rejeitar status inválidos', () => {
      expect(() => new StatusPeriodo('INVALID' as any)).toThrow();
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
});
