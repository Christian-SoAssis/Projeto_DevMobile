import { ConflictResolutionService } from '../../src/domain/services/ConflictResolutionService';
import { SincronizacaoService } from '../../src/domain/services/SincronizacaoService';
import { RegraGeracaoPdfService } from '../../src/domain/services/RegraGeracaoPdfService';
import { RegraDevolucaoService } from '../../src/domain/services/RegraDevolucaoService';
import { Animal } from '../../src/domain/entities/Animal';
import { AnimalPhoto } from '../../src/domain/entities/AnimalPhoto';
import { PeriodoAvaliacao } from '../../src/domain/entities/PeriodoAvaliacao';
import { AnimalCharacteristics } from '../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../src/domain/value-objects/ApproximateLocation';
import { SyncAction } from '../../src/domain/entities/SyncAction';
import { Assinatura } from '../../src/domain/value-objects/Assinatura';

describe('Domain Services', () => {
  const dummyLoc = new ApproximateLocation({
    latitude: -21.55,
    longitude: -45.43,
    neighborhood: 'Centro',
    city: 'Varginha',
    region: 'MG',
  });
  const dummyChar = new AnimalCharacteristics({
    species: 'Cão',
    size: 'Médio',
    approximateAge: '2 anos',
    sex: 'Fêmea',
  });

  describe('ConflictResolutionService', () => {
    it('deve resolver conflito automaticamente quando as versões não possuem riscos de status divergente', () => {
      const local = new Animal({
        id: 'a1',
        ownerId: 'u1',
        name: 'Rex Local',
        characteristics: dummyChar,
        location: dummyLoc,
        updatedAt: '2026-09-25T10:00:00Z',
        version: 1,
      });

      const remote = new Animal({
        id: 'a1',
        ownerId: 'u1',
        name: 'Rex Remoto',
        characteristics: dummyChar,
        location: dummyLoc,
        updatedAt: '2026-09-25T11:00:00Z',
        version: 2,
      });

      const result = ConflictResolutionService.evaluateAnimalConflict(local, remote);
      expect(result.needsReview).toBe(false);
      expect(result.chosenVersion?.name).toBe('Rex Remoto');
    });

    it('deve indicar necessidade de revisão quando o status diverge entre local e remoto', () => {
      const local = new Animal({
        id: 'a1',
        ownerId: 'u1',
        name: 'Rex Local',
        characteristics: dummyChar,
        location: dummyLoc,
        version: 2,
      });
      local.markAdopted('u1');

      const remote = new Animal({
        id: 'a1',
        ownerId: 'u1',
        name: 'Rex Remoto',
        characteristics: dummyChar,
        location: dummyLoc,
        version: 2,
      });

      const result = ConflictResolutionService.evaluateAnimalConflict(local, remote);
      expect(result.needsReview).toBe(true);
      expect(result.reason).toContain('Revisão manual do responsável é necessária');
    });
  });

  describe('SincronizacaoService', () => {
    it('deve calcular backoff exponencial e verificar se ação falha pode ter retry', () => {
      const action = new SyncAction({
        id: 's1',
        operation: 'CREATE',
        entityType: 'animal',
        entityId: 'a1',
        payload: {},
      });
      action.markFailed('Erro');

      expect(SincronizacaoService.shouldRetry(action, 5)).toBe(true);
      expect(SincronizacaoService.calculateBackoffDelayMs(1)).toBe(2000);
      expect(SincronizacaoService.calculateBackoffDelayMs(2)).toBe(4000);
    });
  });

  describe('RegraGeracaoPdfService & RegraDevolucaoService', () => {
    it('deve validar regras de PDF e devolução', () => {
      const animal = new Animal({
        id: 'a1',
        ownerId: 'u1',
        name: 'Rex',
        characteristics: dummyChar,
        location: dummyLoc,
      });
      expect(RegraGeracaoPdfService.podeGerarPdfAnimal(animal)).toBe(false);

      animal.addPhoto(new AnimalPhoto({ id: 'p1', animalId: 'a1', localPath: 'file://p1.jpg' }));
      expect(RegraGeracaoPdfService.podeGerarPdfAnimal(animal)).toBe(true);

      const p = new PeriodoAvaliacao({ id: 'p1', estagioId: 'e1', alunoId: 'al1' });
      p.adicionarAtividade({ id: 'at1', descricao: 'Code', horas: 5 });
      p.adicionarAssinatura(new Assinatura('data:image/png;base64,123456789012', 'resp1'));
      expect(RegraGeracaoPdfService.podeGerarPdfPeriodo(p)).toBe(true);

      expect(() => RegraDevolucaoService.devolverPeriodo(p, '')).toThrow('Motivo da devolução é obrigatório.');

      RegraDevolucaoService.devolverPeriodo(p, 'Faltou documento');
      expect(p.status.isDevolvido()).toBe(true);
    });
  });
});
