import { Animal } from '../../src/domain/entities/Animal';
import { AnimalPhoto } from '../../src/domain/entities/AnimalPhoto';
import { User } from '../../src/domain/entities/User';
import { Favorite } from '../../src/domain/entities/Favorite';
import { AdoptionInterest } from '../../src/domain/entities/AdoptionInterest';
import { SyncAction } from '../../src/domain/entities/SyncAction';
import { PeriodoAvaliacao } from '../../src/domain/entities/PeriodoAvaliacao';
import { Estagio } from '../../src/domain/entities/Estagio';
import { TokenSupervisor } from '../../src/domain/entities/TokenSupervisor';
import { AnimalCharacteristics } from '../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../src/domain/value-objects/ApproximateLocation';
import { ContactInfo } from '../../src/domain/value-objects/ContactInfo';
import { Assinatura } from '../../src/domain/value-objects/Assinatura';
import { Criterio } from '../../src/domain/value-objects/Criterio';

describe('Domain Entities & Aggregates', () => {
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

  describe('Animal Aggregate Root', () => {
    it('deve instanciar animal disponível com versão 1', () => {
      const animal = new Animal({
        id: 'anim_1',
        ownerId: 'usr_owner',
        name: 'Rex',
        characteristics: dummyChar,
        location: dummyLoc,
      });

      expect(animal.name).toBe('Rex');
      expect(animal.status.isAvailable()).toBe(true);
      expect(animal.version).toBe(1);
    });

    it('deve validar obrigatoriedade de id, ownerId, name e location', () => {
      expect(() => new Animal({ id: '', ownerId: 'u1', name: 'R', characteristics: dummyChar, location: dummyLoc })).toThrow('ID do animal é obrigatório.');
      expect(() => new Animal({ id: 'a1', ownerId: '', name: 'R', characteristics: dummyChar, location: dummyLoc })).toThrow('ID do proprietário é obrigatório.');
      expect(() => new Animal({ id: 'a1', ownerId: 'u1', name: '', characteristics: dummyChar, location: dummyLoc })).toThrow('Nome do animal é obrigatório.');
      expect(() => new Animal({ id: 'a1', ownerId: 'u1', name: 'R', characteristics: dummyChar, location: null as any })).toThrow('Localização aproximada é obrigatória.');
    });

    it('deve permitir alterar dados se o solicitante for o proprietário', () => {
      const animal = new Animal({
        id: 'anim_1',
        ownerId: 'usr_owner',
        name: 'Rex',
        characteristics: dummyChar,
        location: dummyLoc,
      });

      const newChar = new AnimalCharacteristics({ species: 'Gato', size: 'Pequeno', approximateAge: '1 ano', sex: 'Macho' });
      const newLoc = new ApproximateLocation({ latitude: -21.56, longitude: -45.44, neighborhood: 'Vila', city: 'Varginha', region: 'MG' });

      animal.updateData('usr_owner', { name: 'Rex Magnífico', characteristics: newChar, location: newLoc });
      expect(animal.name).toBe('Rex Magnífico');
      expect(animal.characteristics.species).toBe('Gato');
      expect(animal.location.neighborhood).toBe('Vila');
      expect(animal.version).toBe(2);
    });

    it('deve rejeitar adição de foto que não pertença a este animal', () => {
      const animal = new Animal({ id: 'anim_1', ownerId: 'usr_owner', name: 'Rex', characteristics: dummyChar, location: dummyLoc });
      const photoWrong = new AnimalPhoto({ id: 'p1', animalId: 'outro_animal', localPath: 'p.jpg' });
      expect(() => animal.addPhoto(photoWrong)).toThrow('Foto não pertence a este animal.');
    });

    it('deve rejeitar remoção de foto por não-proprietário', () => {
      const animal = new Animal({ id: 'anim_1', ownerId: 'usr_owner', name: 'Rex', characteristics: dummyChar, location: dummyLoc });
      const photo = new AnimalPhoto({ id: 'p1', animalId: 'anim_1', localPath: 'p.jpg' });
      animal.addPhoto(photo);
      expect(() => animal.removePhoto('p1', 'hacker')).toThrow('Somente o responsável pode remover fotos.');
    });
  });

  describe('User, Favorite, AdoptionInterest', () => {
    it('deve validar obrigatoriedade de IDs em User, Favorite e AdoptionInterest', () => {
      expect(() => new User({ id: '', name: 'Ana', contactInfo: new ContactInfo('ana@e.com') })).toThrow('ID do usuário é obrigatório.');
      expect(() => new User({ id: 'u1', name: '', contactInfo: new ContactInfo('ana@e.com') })).toThrow('Nome do usuário é obrigatório.');

      expect(() => new Favorite('', 'a1')).toThrow('ID do usuário é obrigatório.');
      expect(() => new Favorite('u1', '')).toThrow('ID do animal é obrigatório.');

      expect(() => new AdoptionInterest('', 'u1', 'a1')).toThrow('ID do interesse é obrigatório.');
      expect(() => new AdoptionInterest('i1', '', 'a1')).toThrow('ID do usuário é obrigatório.');
      expect(() => new AdoptionInterest('i1', 'u1', '')).toThrow('ID do animal é obrigatório.');
    });
  });

  describe('SyncAction Queue Aggregate', () => {
    it('deve validar construtor e resetForRetry', () => {
      expect(() => new SyncAction({ id: '', operation: 'CREATE', entityType: 'animal', entityId: 'a1', payload: {} })).toThrow();
      expect(() => new SyncAction({ id: 's1', operation: '' as any, entityType: 'animal', entityId: 'a1', payload: {} })).toThrow();
      expect(() => new SyncAction({ id: 's1', operation: 'CREATE', entityType: '' as any, entityId: 'a1', payload: {} })).toThrow();
      expect(() => new SyncAction({ id: 's1', operation: 'CREATE', entityType: 'animal', entityId: '', payload: {} })).toThrow();

      const action = new SyncAction({ id: 's1', operation: 'CREATE', entityType: 'animal', entityId: 'a1', payload: {} });
      action.markFailed('Err');
      action.resetForRetry();
      expect(action.status.isPending()).toBe(true);
    });
  });

  describe('PeriodoAvaliacao, Estagio e TokenSupervisor', () => {
    it('deve validar obrigatoriedade de id, estagioId e alunoId', () => {
      expect(() => new PeriodoAvaliacao({ id: '', estagioId: 'e1', alunoId: 'al1' })).toThrow();
      expect(() => new PeriodoAvaliacao({ id: 'p1', estagioId: '', alunoId: 'al1' })).toThrow();
      expect(() => new PeriodoAvaliacao({ id: 'p1', estagioId: 'e1', alunoId: '' })).toThrow();
    });

    it('deve impedir alterar atividades ou autoavaliação em período APROVADO', () => {
      const p = new PeriodoAvaliacao({ id: 'p1', estagioId: 'e1', alunoId: 'al1' });
      p.adicionarAtividade({ id: 'at1', descricao: 'Code', horas: 5 });
      p.adicionarAssinatura(new Assinatura('data:image/png;base64,123456789012', 'resp1'));
      p.aprovar();

      expect(() => p.adicionarAtividade({ id: 'at2', descricao: 'Doc', horas: 2 })).toThrow('Não é possível alterar um período já APROVADO.');
      expect(() => p.registrarAutoAvaliacao([new Criterio('C', 8)])).toThrow('Não é possível alterar autoavaliação em um período já APROVADO.');
    });

    it('deve impedir aprovar sem assinatura', () => {
      const p = new PeriodoAvaliacao({ id: 'p1', estagioId: 'e1', alunoId: 'al1' });
      expect(() => p.aprovar()).toThrow('Para aprovar o período é necessária ao menos uma assinatura.');
    });

    it('deve validar contrutor de Estagio e TokenSupervisor', () => {
      expect(() => new Estagio('', 'al1', 'sup1', 'Emp')).toThrow();
      expect(() => new Estagio('e1', '', 'sup1', 'Emp')).toThrow();
      expect(() => new Estagio('e1', 'al1', '', 'Emp')).toThrow();

      expect(() => new TokenSupervisor('', 'sup1', new Date())).toThrow();
      expect(() => new TokenSupervisor('tok', '', new Date())).toThrow();
    });
  });
});
