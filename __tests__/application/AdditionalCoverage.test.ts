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
import { UserRepositoryFake } from '../../src/application/fakes/UserRepositoryFake';
import { RegisterAdoptionInterestUseCase } from '../../src/application/use-cases/RegisterAdoptionInterestUseCase';
import { User } from '../../src/domain/entities/User';
import { AdoptionInterest } from '../../src/domain/entities/AdoptionInterest';
import { TokenSupervisor } from '../../src/domain/entities/TokenSupervisor';
import { SessionStorageFake } from '../../src/application/fakes/SessionStorageFake';
import { ToggleFavoriteUseCase } from '../../src/application/use-cases/ToggleFavoriteUseCase';
import { Favorite } from '../../src/domain/entities/Favorite';
import { ConflictResolutionService } from '../../src/domain/services/ConflictResolutionService';
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
    await expect(repo.deleteRemote(a1.id)).rejects.toThrow();

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

  it('UserRepositoryFake: exercitar findById, findByEmail e save', async () => {
    const userRepo = new UserRepositoryFake();
    const user = new User({
      id: 'u_test',
      name: 'Teste',
      contactInfo: new ContactInfo('teste@exemplo.com'),
    });
    await userRepo.save(user);

    expect(await userRepo.findById('u_test')).toEqual(user);
    expect(await userRepo.findById('u_inexistente')).toBeNull();

    expect(await userRepo.findByEmail('TESTE@EXEMPLO.COM')).toEqual(user);
    expect(await userRepo.findByEmail('outro@exemplo.com')).toBeNull();
  });

  it('AdoptionInterestRepositoryFake: exercitar listByUser e listByAnimal', async () => {
    const repo = new AdoptionInterestRepositoryFake();
    const interest = new AdoptionInterest('i1', 'u1', 'a1');
    await repo.registerInterest(interest);
    await repo.registerInterest(interest); // duplicado não deve inserir novamente

    expect((await repo.listByUser('u1')).length).toBe(1);
    expect((await repo.listByUser('u2')).length).toBe(0);
    expect((await repo.listByAnimal('a1')).length).toBe(1);
    expect((await repo.listByAnimal('a2')).length).toBe(0);
  });

  it('AuthGatewayFake & CameraGatewayFake & SyncQueueRepositoryFake: cobrir todos os fluxos', async () => {
    const auth = new AuthGatewayFake();
    await expect(auth.login('ana@exemplo.com', 'wrong_password')).rejects.toThrow('Credenciais inválidas.');
    await expect(auth.login('naoexiste@exemplo.com', '123')).rejects.toThrow('Usuário não encontrado.');

    await auth.login('ana@exemplo.com', '123');
    expect(await auth.getCurrentSession()).not.toBeNull();
    await auth.logout();
    expect(await auth.getCurrentSession()).toBeNull();

    const tokenSupVal = await auth.validarTokenSupervisor('valid_supervisor_token');
    expect(tokenSupVal).not.toBeNull();
    const tokenSupInvalid = await auth.validarTokenSupervisor('invalid');
    expect(tokenSupInvalid).toBeNull();

    const camera = new CameraGatewayFake();
    const photoRes = await camera.pickImageFromGallery();
    expect(photoRes).not.toBeNull();

    const syncQueue = new SyncQueueRepositoryFake();
    const action = new SyncAction({ id: 'sa1', operation: 'CREATE', entityType: 'animal', entityId: 'a1', payload: {} });
    await syncQueue.enqueue(action);
    expect(await syncQueue.findById('sa1')).toEqual(action);
    await syncQueue.delete('sa1');
    expect(await syncQueue.findById('sa1')).toBeNull();
  });

  it('UseCases: cobrir erros de validação e exceções de falha de conexão', async () => {
    const animalRepo = new AnimalRepositoryFake();
    const queueRepo = new SyncQueueRepositoryFake();
    const interestRepo = new AdoptionInterestRepositoryFake();

    const getDetails = new GetAnimalDetailsUseCase(animalRepo);
    await expect(getDetails.execute('')).rejects.toThrow('ID do animal é obrigatório.');

    const regInterest = new RegisterAdoptionInterestUseCase(interestRepo);
    await expect(regInterest.execute('', 'a1')).rejects.toThrow('Usuário deve estar autenticado para demonstrar interesse.');
    await expect(regInterest.execute('u1', '')).rejects.toThrow('ID do animal é obrigatório.');

    const deleteUseCase = new DeleteAnimalUseCase(animalRepo, queueRepo);
    await expect(deleteUseCase.execute('u1', 'a_inexistente', true)).rejects.toThrow('Anúncio não encontrado.');

    const updateUseCase = new UpdateAnimalUseCase(animalRepo, queueRepo);
    await expect(updateUseCase.execute('u1', 'a_inexistente', {}, true)).rejects.toThrow('Anúncio de animal não encontrado.');

    const markAdoptedUseCase = new MarkAnimalAdoptedUseCase(animalRepo, queueRepo);
    await expect(markAdoptedUseCase.execute('u1', 'a_inexistente', true)).rejects.toThrow('Animal não encontrado.');

    // Testar fallback para fila quando deleteRemote/updateRemote falharem online ou se isOnline for false
    const a1 = new Animal({ id: 'a1', ownerId: 'u1', name: 'Rex', characteristics: dummyChar, location: dummyLoc });
    await animalRepo.saveLocal(a1);
    animalRepo.isOnline = false;

    await markAdoptedUseCase.execute('u1', 'a1', false);
    expect((await queueRepo.listPending()).length).toBe(1);

    animalRepo.isOnline = true;
    animalRepo.deleteRemote = jest.fn().mockRejectedValue(new Error('Falha remota ao deletar'));
    await deleteUseCase.execute('u1', 'a1', true);

    animalRepo.updateRemote = jest.fn().mockRejectedValue(new Error('Falha remota ao atualizar'));
    await updateUseCase.execute('u1', 'a1', { name: 'Rex Atualizado' }, true);
  });

  it('GerarPdfUseCase & PeriodoAvaliacao: exercitar relatórios e restrições quando aprovado', () => {
    const pdfUseCase = new GerarPdfUseCase();
    const periodoRepo = new PeriodoAvaliacaoRepositoryFake();
    const p1 = new PeriodoAvaliacao({ id: 'p1', estagioId: 'e1', alunoId: 'al1' });

    expect(() => pdfUseCase.executeForPeriodo(p1)).toThrow('Não é possível gerar PDF: período sem atividades ou sem assinaturas válidas.');

    p1.adicionarAtividade({ id: 'at1', descricao: 'Ativ', horas: 4 });
    p1.adicionarAssinatura(new Assinatura('data:image/png;base64,hashval123456', 'al1'));
    p1.adicionarAssinatura(new Assinatura('data:image/png;base64,hashval789012', 'sup1'));

    const pdfRes = pdfUseCase.executeForPeriodo(p1);
    expect(pdfRes.pdfBase64).toContain('mock_pdf_periodo_p1');

    expect(p1.criteriosAvaliacao).toEqual([]);
    expect(p1.autoAvaliacao).toEqual([]);

    p1.aprovar();
    expect(() => p1.registrarAvaliacaoSupervisor([])).toThrow('Não é possível registrar 2ª avaliação em um período já APROVADO.');
  });

  it('Animal & AnimalPhoto: cobrir fotos, exibições e exceções de remoção', () => {
    expect(() => new AnimalPhoto({ id: 'p1', animalId: 'a1' })).toThrow('A foto deve possuir um caminho local ou uma URL remota.');

    const photo = new AnimalPhoto({ id: 'p1', animalId: 'a1', localPath: 'file://local.jpg' });
    expect(photo.localPath).toBe('file://local.jpg');
    expect(photo.remoteUrl).toBeUndefined();
    expect(photo.displayUrl).toBe('file://local.jpg');
    photo.markUploaded('http://example.com/remote.jpg');
    expect(photo.remoteUrl).toBe('http://example.com/remote.jpg');
    expect(photo.displayUrl).toBe('http://example.com/remote.jpg');

    const animal = new Animal({ id: 'a1', ownerId: 'u1', name: 'Rex', characteristics: dummyChar, location: dummyLoc });
    animal.addPhoto(photo);
    expect(animal.photos.length).toBe(1);

    expect(() => animal.removePhoto('p1', 'hacker')).toThrow('Somente o responsável pode remover fotos.');
    animal.removePhoto('p1', 'u1');
    expect(animal.photos.length).toBe(0);

    animal.markAdopted('u1');
    expect(() => animal.markAdopted('u1')).toThrow('Este animal já está marcado como adotado.');
  });

  it('Cobrir casos de borda e validações em use-cases, entidades, fakes e services', async () => {
    // FavoriteRepositoryFake & ToggleFavoriteUseCase
    const favRepo = new FavoriteRepositoryFake();
    const fav = new Favorite('u1', 'a1');
    await favRepo.addFavorite(fav);
    expect((await favRepo.listByUser('u1')).length).toBe(1);

    const toggleFav = new ToggleFavoriteUseCase(favRepo);
    await expect(toggleFav.execute('', 'a1')).rejects.toThrow('Usuário autenticado é obrigatório para favoritar.');
    await expect(toggleFav.execute('u1', '')).rejects.toThrow('ID do animal é obrigatório.');

    // SyncQueueRepositoryFake listPending com falhas e clearCompleted
    const queueRepo = new SyncQueueRepositoryFake();
    const actionFail = new SyncAction({ id: 's_fail', operation: 'UPDATE', entityType: 'animal', entityId: 'a1', payload: {} });
    actionFail.markFailed('Erro simulado');
    await queueRepo.enqueue(actionFail);
    expect((await queueRepo.listPending()).length).toBe(1);

    const actionDone = new SyncAction({ id: 's_done', operation: 'UPDATE', entityType: 'animal', entityId: 'a1', payload: {} });
    actionDone.markCompleted();
    await queueRepo.enqueue(actionDone);
    await queueRepo.clearCompleted();
    expect(await queueRepo.findById('s_done')).toBeNull();

    // AcessarViaTokenUseCase, AuthenticateUserUseCase, AprovarRelatorioUseCase, etc
    const authGateway = new AuthGatewayFake();
    const sessionStorage = new SessionStorageFake();
    const tokenUseCase = new AcessarViaTokenUseCase(authGateway, sessionStorage);
    await expect(tokenUseCase.execute('')).rejects.toThrow('Token de acesso é obrigatório.');

    const authUseCase = new AuthenticateUserUseCase(authGateway, sessionStorage);
    await expect(authUseCase.execute('', '')).rejects.toThrow('E-mail e senha são obrigatórios.');

    const periodoRepo = new PeriodoAvaliacaoRepositoryFake();
    const aprUseCase = new AprovarRelatorioUseCase(periodoRepo);
    await expect(aprUseCase.execute('p_invalido')).rejects.toThrow('Período de avaliação não encontrado.');

    const avalUseCase = new AvaliarDesempenhoUseCase(periodoRepo);
    await expect(avalUseCase.execute('p_invalido', [])).rejects.toThrow('Período de avaliação não encontrado.');

    const devUseCase = new DevolverRelatorioUseCase(periodoRepo);
    await expect(devUseCase.execute('p_invalido', 'motivo')).rejects.toThrow('Período de avaliação não encontrado.');

    const autoUseCase = new RealizarAutoAvaliacaoUseCase(periodoRepo);
    await expect(autoUseCase.execute('p_invalido', [])).rejects.toThrow('Período de avaliação não encontrado.');

    // CreateAnimalUseCase fallback quando createRemote falhar online
    const animalRepo = new AnimalRepositoryFake();
    const createUseCase = new CreateAnimalUseCase(animalRepo, queueRepo);
    const a1 = new Animal({ id: 'a1', ownerId: 'u1', name: 'Rex', characteristics: dummyChar, location: dummyLoc });
    animalRepo.createRemote = jest.fn().mockRejectedValue(new Error('Erro no servidor remoto'));
    const createRes = await createUseCase.execute(a1, true);
    expect(createRes.synced).toBe(false);

    // ProcessSyncQueueUseCase quando sincronização falhar
    const processUseCase = new ProcessSyncQueueUseCase(queueRepo, animalRepo);
    const actionErr = new SyncAction({ id: 's_err', operation: 'DELETE', entityType: 'animal', entityId: 'a_err', payload: {} });
    await queueRepo.enqueue(actionErr);
    animalRepo.deleteRemote = jest.fn().mockRejectedValue(new Error('Erro de conexão no delete'));
    const processRes = await processUseCase.execute();
    expect(processRes.failedCount).toBeGreaterThan(0);

    // SearchAnimalsUseCase quando busca remota falhar
    const searchUseCase = new SearchAnimalsUseCase(animalRepo);
    animalRepo.search = jest.fn().mockRejectedValue(new Error('Falha na busca'));
    await expect(searchUseCase.execute({}, true)).rejects.toThrow('Falha na busca');

    // ConflictResolutionService com versões iguais
    const aRemote = new Animal({ id: 'a1', ownerId: 'u1', name: 'Rex', characteristics: dummyChar, location: dummyLoc });
    const evalRes = ConflictResolutionService.evaluateAnimalConflict(a1, aRemote);
    expect(evalRes.needsReview).toBe(false);

    // SyncAction resetForRetry & TokenSupervisor revogar & User isAdmin & ApproximateLocation sem region
    actionFail.resetForRetry();
    expect(actionFail.status.isPending()).toBe(true);

    const tokSup = new TokenSupervisor('token1', 'sup1', new Date(Date.now() + 10000));
    tokSup.revogar();
    expect(tokSup.isValid()).toBe(false);

    const userAdmin = new User({ id: 'u_admin', name: 'Admin', contactInfo: new ContactInfo('adm@ex.com'), role: 'ADMIN' });
    expect(userAdmin.isAdmin()).toBe(true);

    const locNoRegion = new ApproximateLocation({ latitude: 0, longitude: 0, neighborhood: 'B', city: 'Cidade', region: '' });
    expect(locNoRegion.region).toBe('Cidade');
  });
});
