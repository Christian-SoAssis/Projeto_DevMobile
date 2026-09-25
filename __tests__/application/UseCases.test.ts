import { SearchAnimalsUseCase } from '../../src/application/use-cases/SearchAnimalsUseCase';
import { GetAnimalDetailsUseCase } from '../../src/application/use-cases/GetAnimalDetailsUseCase';
import { CreateAnimalUseCase } from '../../src/application/use-cases/CreateAnimalUseCase';
import { UpdateAnimalUseCase } from '../../src/application/use-cases/UpdateAnimalUseCase';
import { DeleteAnimalUseCase } from '../../src/application/use-cases/DeleteAnimalUseCase';
import { MarkAnimalAdoptedUseCase } from '../../src/application/use-cases/MarkAnimalAdoptedUseCase';
import { ToggleFavoriteUseCase } from '../../src/application/use-cases/ToggleFavoriteUseCase';
import { RegisterAdoptionInterestUseCase } from '../../src/application/use-cases/RegisterAdoptionInterestUseCase';
import { ProcessSyncQueueUseCase } from '../../src/application/use-cases/ProcessSyncQueueUseCase';
import { ResolveSyncConflictUseCase } from '../../src/application/use-cases/ResolveSyncConflictUseCase';
import { AuthenticateUserUseCase } from '../../src/application/use-cases/AuthenticateUserUseCase';
import { AcessarViaTokenUseCase } from '../../src/application/use-cases/AcessarViaTokenUseCase';
import { GerarPdfUseCase } from '../../src/application/use-cases/GerarPdfUseCase';
import { RegistrarAtividadesUseCase } from '../../src/application/use-cases/RegistrarAtividadesUseCase';
import { AssinarRelatorioUseCase } from '../../src/application/use-cases/AssinarRelatorioUseCase';
import { AprovarRelatorioUseCase } from '../../src/application/use-cases/AprovarRelatorioUseCase';

import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { SyncQueueRepositoryFake } from '../../src/application/fakes/SyncQueueRepositoryFake';
import { FavoriteRepositoryFake } from '../../src/application/fakes/FavoriteRepositoryFake';
import { AdoptionInterestRepositoryFake } from '../../src/application/fakes/AdoptionInterestRepositoryFake';
import { AuthGatewayFake } from '../../src/application/fakes/AuthGatewayFake';
import { SessionStorageFake } from '../../src/application/fakes/SessionStorageFake';
import { PeriodoAvaliacaoRepositoryFake } from '../../src/application/fakes/PeriodoAvaliacaoRepositoryFake';

import { Animal } from '../../src/domain/entities/Animal';
import { AnimalPhoto } from '../../src/domain/entities/AnimalPhoto';
import { PeriodoAvaliacao } from '../../src/domain/entities/PeriodoAvaliacao';
import { AnimalCharacteristics } from '../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../src/domain/value-objects/ApproximateLocation';
import { Assinatura } from '../../src/domain/value-objects/Assinatura';

describe('Application Use Cases with In-Memory Fakes', () => {
  let animalRepo: AnimalRepositoryFake;
  let syncQueueRepo: SyncQueueRepositoryFake;
  let favoriteRepo: FavoriteRepositoryFake;
  let interestRepo: AdoptionInterestRepositoryFake;
  let authGateway: AuthGatewayFake;
  let sessionStorage: SessionStorageFake;
  let periodoRepo: PeriodoAvaliacaoRepositoryFake;

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

  beforeEach(() => {
    animalRepo = new AnimalRepositoryFake();
    syncQueueRepo = new SyncQueueRepositoryFake();
    favoriteRepo = new FavoriteRepositoryFake();
    interestRepo = new AdoptionInterestRepositoryFake();
    authGateway = new AuthGatewayFake();
    sessionStorage = new SessionStorageFake();
    periodoRepo = new PeriodoAvaliacaoRepositoryFake();
  });

  it('SearchAnimalsUseCase: deve retornar anúncios filtrados ou em cache quando offline', async () => {
    const animal1 = new Animal({ id: 'a1', ownerId: 'u1', name: 'Luna', characteristics: dummyChar, location: dummyLoc });
    await animalRepo.saveLocal(animal1);

    const useCase = new SearchAnimalsUseCase(animalRepo);
    const resOnline = await useCase.execute({ species: 'Cão' }, true);
    expect(resOnline.animals.length).toBe(1);
    expect(resOnline.isOffline).toBe(false);

    const resOffline = await useCase.execute({}, false);
    expect(resOffline.animals.length).toBe(1);
    expect(resOffline.isOffline).toBe(true);
  });

  it('GetAnimalDetailsUseCase: deve buscar anúncio por ID', async () => {
    const animal = new Animal({ id: 'a1', ownerId: 'u1', name: 'Luna', characteristics: dummyChar, location: dummyLoc });
    await animalRepo.saveLocal(animal);

    const useCase = new GetAnimalDetailsUseCase(animalRepo);
    const found = await useCase.execute('a1');
    expect(found?.name).toBe('Luna');
  });

  it('CreateAnimalUseCase: deve salvar remotamente se online ou enfileirar no SQLite se offline', async () => {
    const animal = new Animal({ id: 'a1', ownerId: 'u1', name: 'Luna', characteristics: dummyChar, location: dummyLoc });
    const useCase = new CreateAnimalUseCase(animalRepo, syncQueueRepo);

    const resOnline = await useCase.execute(animal, true);
    expect(resOnline.synced).toBe(true);

    const animalOffline = new Animal({ id: 'a2', ownerId: 'u1', name: 'Bob', characteristics: dummyChar, location: dummyLoc });
    const resOffline = await useCase.execute(animalOffline, false);
    expect(resOffline.synced).toBe(false);

    const pending = await syncQueueRepo.listPending();
    expect(pending.length).toBe(1);
    expect(pending[0].operation).toBe('CREATE');
  });

  it('UpdateAnimalUseCase & DeleteAnimalUseCase: devem validar proprietário e enfileirar mutações offline', async () => {
    const animal = new Animal({ id: 'a1', ownerId: 'u1', name: 'Luna', characteristics: dummyChar, location: dummyLoc });
    await animalRepo.saveLocal(animal);

    const updateUseCase = new UpdateAnimalUseCase(animalRepo, syncQueueRepo);
    await updateUseCase.execute('u1', 'a1', { name: 'Luna Nova' }, false);

    const updated = await animalRepo.findById('a1');
    expect(updated?.name).toBe('Luna Nova');

    const deleteUseCase = new DeleteAnimalUseCase(animalRepo, syncQueueRepo);
    await deleteUseCase.execute('u1', 'a1', false);

    const pending = await syncQueueRepo.listPending();
    expect(pending.some((p) => p.operation === 'UPDATE')).toBe(true);
    expect(pending.some((p) => p.operation === 'DELETE')).toBe(true);
  });

  it('MarkAnimalAdoptedUseCase: somente o responsável pode marcar como adotado', async () => {
    const animal = new Animal({ id: 'a1', ownerId: 'u1', name: 'Luna', characteristics: dummyChar, location: dummyLoc });
    await animalRepo.saveLocal(animal);

    const useCase = new MarkAnimalAdoptedUseCase(animalRepo, syncQueueRepo);
    const adopted = await useCase.execute('u1', 'a1', true);
    expect(adopted.status.isAdopted()).toBe(true);

    await expect(useCase.execute('u_hacker', 'a1', true)).rejects.toThrow('Somente o responsável pelo anúncio pode marcar o animal como adotado.');
  });

  it('ToggleFavoriteUseCase & RegisterAdoptionInterestUseCase: devem registrar interações do interessado', async () => {
    const favUseCase = new ToggleFavoriteUseCase(favoriteRepo);
    const added = await favUseCase.execute('usr_2', 'a1');
    expect(added).toBe(true);

    const removed = await favUseCase.execute('usr_2', 'a1');
    expect(removed).toBe(false);

    const interestUseCase = new RegisterAdoptionInterestUseCase(interestRepo);
    const interest = await interestUseCase.execute('usr_2', 'a1');
    expect(interest.userId).toBe('usr_2');
  });

  it('ProcessSyncQueueUseCase: deve processar fila de sincronização e reconciliar registros', async () => {
    const animal = new Animal({ id: 'a1', ownerId: 'u1', name: 'Luna', characteristics: dummyChar, location: dummyLoc });
    await animalRepo.saveLocal(animal);

    const createUseCase = new CreateAnimalUseCase(animalRepo, syncQueueRepo);
    await createUseCase.execute(animal, false);

    const processUseCase = new ProcessSyncQueueUseCase(syncQueueRepo, animalRepo);
    const result = await processUseCase.execute();

    expect(result.processedCount).toBe(1);
    expect(result.successCount).toBe(1);

    const pendingAfter = await syncQueueRepo.listPending();
    expect(pendingAfter.length).toBe(0);
  });

  it('ResolveSyncConflictUseCase: deve avaliar divergência de versão', () => {
    const local = new Animal({ id: 'a1', ownerId: 'u1', name: 'Luna Local', characteristics: dummyChar, location: dummyLoc, version: 1 });
    const remote = new Animal({ id: 'a1', ownerId: 'u1', name: 'Luna Remoto', characteristics: dummyChar, location: dummyLoc, version: 2 });

    const useCase = new ResolveSyncConflictUseCase();
    const result = useCase.execute(local, remote);
    expect(result.needsReview).toBe(false);
  });

  it('AuthenticateUserUseCase & AcessarViaTokenUseCase: devem autenticar usuário e manter sessão segura', async () => {
    const authUseCase = new AuthenticateUserUseCase(authGateway, sessionStorage);
    const session = await authUseCase.execute('ana@exemplo.com', 'password123');
    expect(session.user.name).toBe('Ana Silva');
    expect(await sessionStorage.getSessionToken()).toBe(session.token);

    const tokenUseCase = new AcessarViaTokenUseCase(authGateway, sessionStorage);
    const tokenSession = await tokenUseCase.execute('fake_token_usr_1');
    expect(tokenSession.user.id).toBe('usr_1');
  });

  it('GerarPdfUseCase: deve exportar PDF quando todas as invariantes e assinaturas estiverem prontas', () => {
    const animal = new Animal({ id: 'a1', ownerId: 'u1', name: 'Luna', characteristics: dummyChar, location: dummyLoc });
    animal.addPhoto(new AnimalPhoto({ id: 'p1', animalId: 'a1', localPath: 'p.jpg' }));

    const pdfUseCase = new GerarPdfUseCase();
    const res = pdfUseCase.executeForAnimal(animal);
    expect(res.pdfBase64).toContain('mock_pdf_animal_a1');
  });

  it('ReportUseCases: deve permitir registrar atividades, assinar e aprovar relatório', async () => {
    const p = new PeriodoAvaliacao({ id: 'p1', estagioId: 'e1', alunoId: 'al1' });
    await periodoRepo.save(p);

    const regAtv = new RegistrarAtividadesUseCase(periodoRepo);
    await regAtv.execute('p1', [{ id: 'at1', descricao: 'Coding', horas: 5 }]);

    const ass = new AssinarRelatorioUseCase(periodoRepo);
    await ass.execute('p1', new Assinatura('data:image/png;base64,123456789012', 'resp1'));

    const apr = new AprovarRelatorioUseCase(periodoRepo);
    const approved = await apr.execute('p1');
    expect(approved.status.isAprovado()).toBe(true);
  });
});
