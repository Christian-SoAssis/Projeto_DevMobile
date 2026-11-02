import { loadAppContainer } from '../../../src/infrastructure/composition/loadAppContainer';
import { InMemorySqliteDriver } from '../../../src/infrastructure/database/sqlite/DatabaseDriver';
import { CreateAnimalUseCase } from '../../../src/application/use-cases/CreateAnimalUseCase';
import { ProcessSyncQueueUseCase } from '../../../src/application/use-cases/ProcessSyncQueueUseCase';
import { ImageProcessorFake } from '../../../src/application/fakes/ImageProcessorFake';
import { SyncAction } from '../../../src/domain/entities/SyncAction';
import { AnimalPhoto } from '../../../src/domain/entities/AnimalPhoto';
import { Animal } from '../../../src/domain/entities/Animal';
import { newUuid } from '../../../src/domain/services/IdGenerator';
import { AnimalCharacteristics } from '../../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../../src/domain/value-objects/ApproximateLocation';
import { FakeSupabaseClient, seedFakeDb } from '../../../test-support/SupabaseFake';

const UID = '3e0d7a30-1111-4444-8888-999999999999';

async function setup() {
  const db = seedFakeDb({ users: [{ id: UID, name: 'Ana', user_type: 'USER' }] });
  const client = new FakeSupabaseClient({ context: { db, currentUserId: UID, isAdmin: false } });
  const container = await loadAppContainer(new InMemorySqliteDriver(), {
    supabaseClient: client,
    imageProcessor: new ImageProcessorFake(),
    readFile: async () => new Uint8Array([1, 2, 3]),
  });
  return { db, client, container };
}

async function createOfflineAnimalWithPhoto(container: Awaited<ReturnType<typeof setup>>['container']) {
  const animalId = newUuid();
  const animal = new Animal({
    id: animalId,
    ownerId: UID,
    name: 'Mel',
    characteristics: new AnimalCharacteristics({
      species: 'Gato',
      size: 'Pequeno',
      approximateAge: '1 ano',
      sex: 'Fêmea',
    }),
    location: new ApproximateLocation({
      latitude: -21.55,
      longitude: -45.43,
      neighborhood: 'Centro',
      city: 'Varginha',
      region: 'MG',
    }),
  });
  // Captura: a conversão para WebP acontece ao persistir (pipeline obrigatório).
  const photo = await container.photoStorage.persistLocal(
    new AnimalPhoto({ id: newUuid(), animalId, localPath: 'file:///cache/cam.jpg' })
  );
  animal.addPhoto(photo);
  await container.animalRepository.saveLocal(animal);
  await container.syncQueueRepository.enqueue(
    new SyncAction({
      id: newUuid(),
      operation: 'CREATE',
      entityType: 'animal',
      entityId: animalId,
      payload: {},
    })
  );
  return { animal, animalId, photo };
}

describe('Passo 4 — foto vai ao Supabase Storage antes do anúncio (doc §14.1)', () => {
  it('sync CREATE: sobe o WebP ao bucket, registra animal_photos e guarda a URL no cache local', async () => {
    const { db, client, container } = await setup();
    const { animalId, photo } = await createOfflineAnimalWithPhoto(container);
    expect(photo.localPath).toMatch(/\.webp$/);

    const useCase = new ProcessSyncQueueUseCase(
      container.syncQueueRepository,
      container.animalRepository,
      undefined,
      container.remotePhotoStorage
    );
    const result = await useCase.execute();

    expect(result).toMatchObject({ successCount: 1, failedCount: 0 });
    const path = `${UID}/${animalId}/${photo.id}.webp`;
    expect(client.storageObjects.get(path)).toMatchObject({ contentType: 'image/webp' });

    const publicUrl = `https://fake.supabase.co/storage/v1/object/public/animal-photos/${path}`;
    expect(db.animals).toHaveLength(1);
    expect(db['animal_photos']).toEqual([
      expect.objectContaining({ id: photo.id, animal_id: animalId, remote_url: publicUrl, is_main: true }),
    ]);

    const local = await container.animalRepository.findById(animalId);
    expect(local?.photos[0].remoteUrl).toBe(publicUrl);
  });

  it('sync repetido não duplica o registro da foto (idempotente)', async () => {
    const { db, container } = await setup();
    const { animalId, animal } = await createOfflineAnimalWithPhoto(container);
    const useCase = new ProcessSyncQueueUseCase(
      container.syncQueueRepository,
      container.animalRepository,
      undefined,
      container.remotePhotoStorage
    );
    await useCase.execute();

    // Edição posterior reenvia o anúncio: a foto já tem URL e não sobe de novo.
    const edited = (await container.animalRepository.findById(animalId))!;
    edited.updateData(UID, { name: 'Mel 2' });
    await container.animalRepository.saveLocal(edited);
    await container.syncQueueRepository.enqueue(
      new SyncAction({ id: newUuid(), operation: 'UPDATE', entityType: 'animal', entityId: animal.id, payload: {} })
    );
    const second = await useCase.execute();

    expect(second.successCount).toBe(1);
    expect(db['animal_photos']).toHaveLength(1);
  });

  it('falha no upload: a ação falha, o anúncio NÃO vai ao servidor e continua na fila para retry', async () => {
    const { db, client, container } = await setup();
    await createOfflineAnimalWithPhoto(container);
    // Servidor recusa o upload (ex.: sem rede/política).
    (client.storage as { from: unknown }).from = () => ({
      upload: async () => ({ data: null, error: { message: 'network down' } }),
      remove: async () => ({ error: null }),
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
    });

    const result = await new ProcessSyncQueueUseCase(
      container.syncQueueRepository,
      container.animalRepository,
      undefined,
      container.remotePhotoStorage
    ).execute();

    expect(result).toMatchObject({ successCount: 0, failedCount: 1 });
    expect(db.animals).toHaveLength(0);
    expect(await container.syncQueueRepository.listPending()).toHaveLength(1);
  });

  it('sem backend (modo offline) a sync não tenta enviar fotos', async () => {
    const container = await loadAppContainer(new InMemorySqliteDriver(), {
      supabaseClient: null,
      imageProcessor: new ImageProcessorFake(),
    });
    expect(container.remotePhotoStorage).toBeUndefined();
  });

  it('criação ONLINE também sobe a foto antes do anúncio (sem passar pela fila)', async () => {
    const { db, client, container } = await setup();
    const animalId = newUuid();
    const animal = new Animal({
      id: animalId,
      ownerId: UID,
      name: 'Online',
      characteristics: new AnimalCharacteristics({ species: 'Cão', size: 'Médio', approximateAge: '2 anos', sex: 'Macho' }),
      location: new ApproximateLocation({ latitude: -21.5, longitude: -45.4, neighborhood: 'Centro', city: 'Varginha', region: 'MG' }),
    });
    const photo = await container.photoStorage.persistLocal(
      new AnimalPhoto({ id: newUuid(), animalId, localPath: 'file:///cache/c.jpg' })
    );
    animal.addPhoto(photo);

    const result = await new CreateAnimalUseCase(
      container.animalRepository,
      container.syncQueueRepository,
      container.unitOfWork
    ).execute(animal, true);

    expect(result.synced).toBe(true);
    expect(client.storageObjects.has(`${UID}/${animalId}/${photo.id}.webp`)).toBe(true);
    expect(db['animal_photos']).toHaveLength(1);
    const local = await container.animalRepository.findById(animalId);
    expect(local?.photos[0].remoteUrl).toContain('/animal-photos/');
  });
});
