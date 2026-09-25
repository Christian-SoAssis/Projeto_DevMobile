import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { SyncQueueRepositoryFake } from '../../src/application/fakes/SyncQueueRepositoryFake';
import { FavoriteRepositoryFake } from '../../src/application/fakes/FavoriteRepositoryFake';
import { AdoptionInterestRepositoryFake } from '../../src/application/fakes/AdoptionInterestRepositoryFake';
import { AuthGatewayFake } from '../../src/application/fakes/AuthGatewayFake';
import { PeriodoAvaliacaoRepositoryFake } from '../../src/application/fakes/PeriodoAvaliacaoRepositoryFake';
import { CameraGatewayFake } from '../../src/application/fakes/CameraGatewayFake';
import { LocationGatewayFake } from '../../src/application/fakes/LocationGatewayFake';

import { SearchAnimalsUseCase } from '../../src/application/use-cases/SearchAnimalsUseCase';
import { GetAnimalDetailsUseCase } from '../../src/application/use-cases/GetAnimalDetailsUseCase';
import { CreateAnimalUseCase } from '../../src/application/use-cases/CreateAnimalUseCase';
import { UpdateAnimalUseCase } from '../../src/application/use-cases/UpdateAnimalUseCase';
import { DeleteAnimalUseCase } from '../../src/application/use-cases/DeleteAnimalUseCase';
import { MarkAnimalAdoptedUseCase } from '../../src/application/use-cases/MarkAnimalAdoptedUseCase';
import { ProcessSyncQueueUseCase } from '../../src/application/use-cases/ProcessSyncQueueUseCase';
import { AuthenticateUserUseCase } from '../../src/application/use-cases/AuthenticateUserUseCase';
import { AcessarViaTokenUseCase } from '../../src/application/use-cases/AcessarViaTokenUseCase';
import { GerarPdfUseCase } from '../../src/application/use-cases/GerarPdfUseCase';
import { AvaliarDesempenhoUseCase } from '../../src/application/use-cases/AvaliarDesempenhoUseCase';
import { RealizarAutoAvaliacaoUseCase } from '../../src/application/use-cases/RealizarAutoAvaliacaoUseCase';
import { DevolverRelatorioUseCase } from '../../src/application/use-cases/DevolverRelatorioUseCase';
import { RegistrarAtividadesUseCase } from '../../src/application/use-cases/RegistrarAtividadesUseCase';
import { AssinarRelatorioUseCase } from '../../src/application/use-cases/AssinarRelatorioUseCase';
import { AprovarRelatorioUseCase } from '../../src/application/use-cases/AprovarRelatorioUseCase';

import { Animal } from '../../src/domain/entities/Animal';
import { AnimalPhoto } from '../../src/domain/entities/AnimalPhoto';
import { SyncAction } from '../../src/domain/entities/SyncAction';
import { PeriodoAvaliacao } from '../../src/domain/entities/PeriodoAvaliacao';
import { Estagio } from '../../src/domain/entities/Estagio';
import { TokenSupervisor } from '../../src/domain/entities/TokenSupervisor';
import { AnimalCharacteristics } from '../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../src/domain/value-objects/ApproximateLocation';
import { Assinatura } from '../../src/domain/value-objects/Assinatura';
import { ContactInfo } from '../../src/domain/value-objects/ContactInfo';
import { Criterio } from '../../src/domain/value-objects/Criterio';
import { SincronizacaoService } from '../../src/domain/services/SincronizacaoService';

describe('Additional Branch Coverage Suite', () => {
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

  it('AnimalRepositoryFake & PeriodoAvaliacaoRepositoryFake: exercitar todos os métodos', async () => {
    const a1 = new Animal({ id: 'a1', ownerId: 'u1', name: 'Rex', characteristics: dummyChar, location: dummyLoc });
    const repo = new AnimalRepositoryFake([a1]);

    const resSize = await repo.search({ size: 'Médio', sex: 'Fêmea', status: 'AVAILABLE', searchQuery: 'Varginha' });
    expect(resSize.length).toBe(1);

    const resOwner = await repo.listByOwner('u1');
    expect(resOwner.length).toBe(1);

    await repo.upsertCache([a1]);

    repo.isOnline = false;
    await expect(repo.createRemote(a1)).rejects.toThrow();
    await expect(repo.updateRemote(a1)).rejects.toThrow();
    await expect(repo.deleteRemote(a1)).rejects.toThrow();

    const periodoRepo = new PeriodoAvaliacaoRepositoryFake();
    const p1 = new PeriodoAvaliacao({ id: 'p1', estagioId: 'e1', alunoId: 'al1' });
    await periodoRepo.save(p1);
    expect(await periodoRepo.findById('p1')).toBeTruthy();
    expect((await periodoRepo.listByEstagio('e1')).length).toBe(1);
  });

  it('Exercitar Use Cases de AvaliarDesempenho, RealizarAutoAvaliacao e DevolverRelatorio', async () => {
    const periodoRepo = new PeriodoAvaliacaoRepositoryFake();
    const p1 = new PeriodoAvaliacao({ id: 'p1', estagioId: 'e1', alunoId: 'al1' });
    await periodoRepo.save(p1);

    const avalSup = new AvaliarDesempenhoUseCase(periodoRepo);
    await avalSup.execute('p1', [new Criterio('C1', 9)]);

    const autoAval = new RealizarAutoAvaliacaoUseCase(periodoRepo);
    await autoAval.execute('p1', [new Criterio('C2', 8)]);

    const dev = new DevolverRelatorioUseCase(periodoRepo);
    const devuelt = await dev.execute('p1', 'Motivo ajuste');
    expect(devuelt.status.isDevolvido()).toBe(true);
  });

  it('GetAnimalDetailsUseCase: deve retornar null quando animal não for encontrado', async () => {
    const useCase = new GetAnimalDetailsUseCase(new AnimalRepositoryFake());
    expect(await useCase.execute('a_inexistente')).toBeNull();
  });

  it('UpdateAnimalUseCase & DeleteAnimalUseCase: devem validar permissões de proprietário', async () => {
    const animalRepo = new AnimalRepositoryFake();
    const queueRepo = new SyncQueueRepositoryFake();

    const a1 = new Animal({ id: 'a1', ownerId: 'u1', name: 'Rex', characteristics: dummyChar, location: dummyLoc });
    await animalRepo.saveLocal(a1);

    const updateUseCase = new UpdateAnimalUseCase(animalRepo, queueRepo);
    await expect(updateUseCase.execute('hacker', 'a1', { name: 'Hack' }, true)).rejects.toThrow();

    const deleteUseCase = new DeleteAnimalUseCase(animalRepo, queueRepo);
    await expect(deleteUseCase.execute('hacker', 'a1', true)).rejects.toThrow();
  });

  it('ProcessSyncQueueUseCase: deve cobrir mutações de DELETE e exceções', async () => {
    const animalRepo = new AnimalRepositoryFake();
    const queueRepo = new SyncQueueRepositoryFake();

    const actionDel = new SyncAction({
      id: 's_del',
      operation: 'DELETE',
      entityType: 'animal',
      entityId: 'a_del',
      payload: {},
    });
    await queueRepo.enqueue(actionDel);

    const processUseCase = new ProcessSyncQueueUseCase(queueRepo, animalRepo);
    const res = await processUseCase.execute();
    expect(res.successCount).toBe(1);

    const actionOther = new SyncAction({
      id: 's_other',
      operation: 'CREATE',
      entityType: 'photo',
      entityId: 'p1',
      payload: {},
    });
    await queueRepo.enqueue(actionOther);
    const resOther = await processUseCase.execute();
    expect(resOther.successCount).toBe(1);
  });

  it('AnimalPhoto, Estagio e TokenSupervisor: exercitar métodos e construtores com defaults', () => {
    const p1 = new AnimalPhoto({ id: 'p1', animalId: 'a1', remoteUrl: 'https://ex.com/p1.jpg' });
    expect(p1.syncState.isCompleted()).toBe(true);
    expect(() => p1.markUploaded('')).toThrow('URL remota inválida para upload.');

    const est = new Estagio('e1', 'al1', 'sup1', '');
    expect(est.empresa).toBe('Empresa Parceira');

    const tok = new TokenSupervisor('t1', 'sup1', new Date(Date.now() + 1000));
    expect(tok.isValid()).toBe(true);

    const tokExpired = new TokenSupervisor('t2', 'sup1', new Date(Date.now() - 1000));
    expect(tokExpired.isValid()).toBe(false);

    const contact = new ContactInfo('user@example.com');
    expect(contact.phone).toBeUndefined();
  });

  it('SincronizacaoService: exercitar backoff padrão', () => {
    const action = new SyncAction({ id: 's1', operation: 'CREATE', entityType: 'animal', entityId: 'a1', payload: {} });
    action.markFailed('Error');
    expect(SincronizacaoService.shouldRetry(action)).toBe(true);
  });
});
