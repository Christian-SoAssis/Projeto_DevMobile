/**
 * @jest-environment node
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { BetterSqliteDriver } from '../../test-support/BetterSqliteDriver';
import { FakeSupabaseClient, FakeSupabaseDb, seedFakeDb } from '../../test-support/SupabaseFake';
import { loadAppContainer, AppContainer } from '../../src/infrastructure/composition/loadAppContainer';
import { getFullSync } from '../../src/adapters/hooks/useFullSync';
import { ImageProcessorFake } from '../../src/application/fakes/ImageProcessorFake';
import { CreateAnimalUseCase } from '../../src/application/use-cases/CreateAnimalUseCase';
import { UpdateAnimalUseCase } from '../../src/application/use-cases/UpdateAnimalUseCase';
import { MarkAnimalAdoptedUseCase } from '../../src/application/use-cases/MarkAnimalAdoptedUseCase';
import { ResolveSyncConflictUseCase } from '../../src/application/use-cases/ResolveSyncConflictUseCase';
import { Animal } from '../../src/domain/entities/Animal';
import { AnimalPhoto } from '../../src/domain/entities/AnimalPhoto';
import { AnimalCharacteristics } from '../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../src/domain/value-objects/ApproximateLocation';
import { newUuid } from '../../src/domain/services/IdGenerator';

/**
 * E2E §16.4 itens 4–6 e 8 com SQLite em ARQUIVO (fechar/reabrir de verdade)
 * e o backend simulado com as mesmas regras do `supabase/init.sql`.
 */
const OWNER = '11111111-1111-4111-8111-111111111111';
const STRANGER = '99999999-9999-4999-8999-999999999999';

describe('E2E offline → sync (doc §16.4 itens 4, 5, 6 e 8)', () => {
  let directory: string;
  let databasePath: string;
  let db: FakeSupabaseDb;
  const opened: BetterSqliteDriver[] = [];

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'enlace-e2e-'));
    databasePath = path.join(directory, 'enlace.db');
    db = seedFakeDb({ users: [] });
  });

  afterEach(() => {
    opened.splice(0).forEach((d) => d.close());
    fs.rmSync(directory, { recursive: true, force: true });
  });

  /** "Abre o app": novo container sobre o MESMO arquivo, com a sessão do usuário. */
  async function openApp(userId: string): Promise<AppContainer> {
    const driver = new BetterSqliteDriver(new Database(databasePath));
    opened.push(driver);
    const client = new FakeSupabaseClient({ context: { db, currentUserId: userId, isAdmin: false } });
    return loadAppContainer(driver, {
      supabaseClient: client,
      imageProcessor: new ImageProcessorFake(),
      readFile: async () => new Uint8Array([1, 2, 3]),
    });
  }

  function closeApp() {
    opened.splice(0).forEach((d) => d.close());
  }

  function newAnimal(photo = false): Animal {
    const id = newUuid();
    const animal = new Animal({
      id,
      ownerId: OWNER,
      name: 'Mel',
      characteristics: new AnimalCharacteristics({ species: 'Gato', size: 'Pequeno', approximateAge: '1 ano', sex: 'Fêmea' }),
      location: new ApproximateLocation({ latitude: -21.55, longitude: -45.43, neighborhood: 'Centro', city: 'Varginha', region: 'MG' }),
    });
    if (photo) animal.addPhoto(new AnimalPhoto({ id: newUuid(), animalId: id, localPath: 'file:///app/mel.webp' }));
    return animal;
  }

  it('item 4: cria offline → fecha o app → reabre → sincroniza (anúncio e foto chegam ao servidor)', async () => {
    let app = await openApp(OWNER);
    const animal = newAnimal(true);
    const created = await new CreateAnimalUseCase(app.animalRepository, app.syncQueueRepository, app.unitOfWork).execute(animal, false);
    expect(created.synced).toBe(false);
    expect(db.animals).toHaveLength(0);

    closeApp();
    app = await openApp(OWNER); // reabre

    expect(await app.syncQueueRepository.listPending()).toHaveLength(1); // fila intacta
    expect((await app.animalRepository.findById(animal.id))?.name).toBe('Mel'); // cache intacto

    const result = await getFullSync(app).execute();

    expect(result.push).toMatchObject({ successCount: 1, failedCount: 0 });
    expect(db.animals.map((a) => a.id)).toContain(animal.id);
    expect(db['animal_photos']).toHaveLength(1);
    expect(await app.syncQueueRepository.listPending()).toHaveLength(0);
  });

  it('item 5: edita offline → fecha e reabre → a edição chega ao servidor', async () => {
    let app = await openApp(OWNER);
    const animal = newAnimal();
    await new CreateAnimalUseCase(app.animalRepository, app.syncQueueRepository, app.unitOfWork).execute(animal, true);
    expect(db.animals).toHaveLength(1);

    await new UpdateAnimalUseCase(app.animalRepository, app.syncQueueRepository, app.unitOfWork).execute(OWNER, animal.id, { name: 'Mel Editada' }, false);
    expect(db.animals[0].name).toBe('Mel');

    closeApp();
    app = await openApp(OWNER);
    const result = await getFullSync(app).execute();

    expect(result.push.successCount).toBe(1);
    expect(db.animals[0].name).toBe('Mel Editada');
  });

  it('item 6: conflito (situação muda nos dois lados) gera revisão e a escolha do responsável vale', async () => {
    let app = await openApp(OWNER);
    const animal = newAnimal();
    await new CreateAnimalUseCase(app.animalRepository, app.syncQueueRepository, app.unitOfWork).execute(animal, true);

    await new MarkAnimalAdoptedUseCase(app.animalRepository, app.syncQueueRepository, app.unitOfWork).execute(OWNER, animal.id, false);
    // Enquanto isso o servidor muda por outro caminho.
    db.animals[0] = { ...db.animals[0], name: 'Mudou no servidor', version: db.animals[0].version + 1 };

    closeApp();
    app = await openApp(OWNER);
    const first = await getFullSync(app).execute();
    expect(first.push.conflictCount).toBe(1);
    expect(db.animals[0].status).toBe('AVAILABLE');

    const resolver = new ResolveSyncConflictUseCase(app.animalRepository, app.remoteAnimalSource!, app.syncQueueRepository);
    const [conflict] = await resolver.listConflicts();
    await resolver.keepLocal(conflict.action.id);
    const second = await getFullSync(app).execute();

    expect(second.push.successCount).toBe(1);
    expect(db.animals[0].status).toBe('ADOPTED');
  });

  it('item 8: terceiro não edita nem exclui anúncio alheio — nem localmente, nem no servidor (RLS)', async () => {
    let app = await openApp(OWNER);
    const animal = newAnimal();
    await new CreateAnimalUseCase(app.animalRepository, app.syncQueueRepository, app.unitOfWork).execute(animal, true);
    closeApp();

    app = await openApp(STRANGER);
    await getFullSync(app).execute(); // traz o anúncio do dono
    const edit = new UpdateAnimalUseCase(app.animalRepository, app.syncQueueRepository, app.unitOfWork);
    await expect(edit.execute(STRANGER, animal.id, { name: 'Invasor' }, true)).rejects.toThrow(
      'Somente o responsável pelo anúncio pode alterar seus dados.'
    );

    // Mesmo contornando o domínio, a "RLS" do servidor recusa o UPDATE.
    const local = (await app.animalRepository.findById(animal.id))!;
    await expect(app.animalRepository.updateRemote(local)).rejects.toThrow();
    expect(db.animals[0].name).toBe('Mel');
  });
});
