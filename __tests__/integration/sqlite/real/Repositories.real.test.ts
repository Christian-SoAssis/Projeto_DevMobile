/**
 * @jest-environment node
 */
import { BetterSqliteDriver } from '../../../../test-support/BetterSqliteDriver';
import { applyMigrations } from '../../../../src/infrastructure/database/sqlite/migrations';
import { SqliteAnimalRepository } from '../../../../src/infrastructure/database/sqlite/repositories/SqliteAnimalRepository';
import { SqliteFavoriteRepository } from '../../../../src/infrastructure/database/sqlite/repositories/SqliteFavoriteRepository';
import { SqliteAdoptionInterestRepository } from '../../../../src/infrastructure/database/sqlite/repositories/SqliteAdoptionInterestRepository';
import { SqliteSyncQueueRepository } from '../../../../src/infrastructure/database/sqlite/repositories/SqliteSyncQueueRepository';
import { SqlitePhotoStorage } from '../../../../src/infrastructure/database/sqlite/repositories/SqlitePhotoStorage';
import { SqliteSearchPreferencesRepository } from '../../../../src/infrastructure/database/sqlite/repositories/SqliteSearchPreferencesRepository';
import { SqliteSyncMetadataRepository } from '../../../../src/infrastructure/database/sqlite/repositories/SqliteSyncMetadataRepository';
import { Favorite } from '../../../../src/domain/entities/Favorite';
import { AdoptionInterest } from '../../../../src/domain/entities/AdoptionInterest';
import { SyncAction } from '../../../../src/domain/entities/SyncAction';
import { SyncMetadata } from '../../../../src/domain/entities/SyncMetadata';
import { makeAnimal, makeCharacteristics, makeLocation, makePhoto } from '../../../../test-support/fixtures';

describe('Contratos dos repositórios sobre SQLite real', () => {
  let driver: BetterSqliteDriver;

  beforeEach(async () => {
    driver = new BetterSqliteDriver();
    await applyMigrations(driver);
  });

  afterEach(() => {
    driver.close();
  });

  describe('SqliteAnimalRepository', () => {
    it('saveLocal insere o anúncio com fotos e o recupera por id', async () => {
      const repository = new SqliteAnimalRepository(driver);
      const animal = makeAnimal({ photos: [makePhoto()] });

      await repository.saveLocal(animal);
      const loaded = await repository.findById(animal.id);

      expect(loaded).not.toBeNull();
      expect(loaded!.name).toBe('Luna');
      expect(loaded!.characteristics.specialCare).toBe('Nenhum');
      expect(loaded!.location.city).toBe('Varginha');
      expect(loaded!.photos).toHaveLength(1);
      expect(loaded!.photos[0].localPath).toBe('file:///tmp/photo_1.jpg');
      expect(loaded!.photos[0].syncState.isPending()).toBe(true);
    });

    it('saveLocal faz upsert e substitui as fotos sem duplicar registros', async () => {
      const repository = new SqliteAnimalRepository(driver);
      await repository.saveLocal(makeAnimal({ photos: [makePhoto()] }));

      const updated = makeAnimal({
        name: 'Luna Nova',
        characteristics: makeCharacteristics({ specialCare: 'Medicação diária' }),
        photos: [makePhoto({ id: 'photo_2', localPath: 'file:///tmp/photo_2.jpg' })],
      });
      await repository.saveLocal(updated);

      const loaded = await repository.findById('animal_1');
      expect(loaded!.name).toBe('Luna Nova');
      expect(loaded!.characteristics.specialCare).toBe('Medicação diária');
      expect(loaded!.photos.map((p) => p.id)).toEqual(['photo_2']);

      const rawPhotos = await driver.getAllAsync(
        `SELECT id FROM animal_photos WHERE animal_id = ?`,
        ['animal_1']
      );
      expect(rawPhotos).toHaveLength(1);
    });

    it('updateRemote persiste todos os campos editáveis (descrição, saúde e cuidados)', async () => {
      const repository = new SqliteAnimalRepository(driver);
      const animal = makeAnimal();
      await repository.saveLocal(animal);

      animal.updateData('user_1', {
        name: 'Luna Editada',
        characteristics: makeCharacteristics({
          characteristics: 'Muito calma',
          behavior: 'Ladra pouco',
          specialCare: 'Vacina anual',
        }),
        location: makeLocation({ city: 'Três Corações', neighborhood: 'Jardim América' }),
      });
      await repository.updateRemote(animal);

      const loaded = await repository.findById('animal_1');
      expect(loaded!.name).toBe('Luna Editada');
      expect(loaded!.characteristics.characteristics).toBe('Muito calma');
      expect(loaded!.characteristics.behavior).toBe('Ladra pouco');
      expect(loaded!.characteristics.specialCare).toBe('Vacina anual');
      expect(loaded!.location.city).toBe('Três Corações');
      expect(loaded!.location.neighborhood).toBe('Jardim América');
      expect(loaded!.version).toBe(animal.version);
    });

    it('deleteLocal remove anúncio, fotos e imagens locais vinculadas', async () => {
      const repository = new SqliteAnimalRepository(driver);
      await repository.saveLocal(makeAnimal({ photos: [makePhoto()] }));
      await driver.runAsync(
        `INSERT INTO local_images (
          id, animal_local_or_remote_id, local_path, upload_status, created_at
        ) VALUES (?, ?, ?, ?, ?)`,
        ['photo_1', 'animal_1', 'file:///tmp/photo_1.jpg', 'PENDING', new Date().toISOString()]
      );

      await repository.deleteLocal('animal_1');

      expect(await repository.findById('animal_1')).toBeNull();
      const photos = await driver.getAllAsync(`SELECT * FROM animal_photos`);
      const images = await driver.getAllAsync(`SELECT * FROM local_images`);
      expect(photos).toHaveLength(0);
      expect(images).toHaveLength(0);
    });

    it('listByOwner e search filtram no SQLite real', async () => {
      const repository = new SqliteAnimalRepository(driver);
      await repository.saveLocal(makeAnimal({ id: 'a1', ownerId: 'u1' }));
      await repository.saveLocal(
        makeAnimal({
          id: 'a2',
          ownerId: 'u2',
          name: 'Rex',
          characteristics: makeCharacteristics({ species: 'Gato', size: 'Grande' }),
        })
      );

      expect((await repository.listByOwner('u1')).map((a) => a.id)).toEqual(['a1']);
      expect((await repository.search({ species: 'Gato' })).map((a) => a.id)).toEqual(['a2']);
      expect(await repository.search({ ownerId: 'u3' })).toHaveLength(0);
    });
  });

  describe('favoritos e interesses', () => {
    it('favoritos são idempotentes no SQLite real', async () => {
      const repository = new SqliteFavoriteRepository(driver);
      const favorite = new Favorite('u1', 'a1');

      await repository.addFavorite(favorite);
      await repository.addFavorite(favorite);
      await repository.addFavorite(new Favorite('u1', 'a1'));

      expect(await repository.listByUser('u1')).toHaveLength(1);
      expect(await repository.isFavorite('u1', 'a1')).toBe(true);
    });

    it('interesses são idempotentes no SQLite real', async () => {
      const repository = new SqliteAdoptionInterestRepository(driver);
      const interest = new AdoptionInterest('int_1', 'u1', 'a1');

      await repository.registerInterest(interest);
      await repository.registerInterest(interest);
      await repository.registerInterest(new AdoptionInterest('int_2', 'u1', 'a1'));

      expect(await repository.listByUser('u1')).toHaveLength(1);
      expect(await repository.listByAnimal('a1')).toHaveLength(1);
      expect(await repository.hasInterest('u1', 'a1')).toBe(true);
    });
  });

  describe('SqliteSyncQueueRepository', () => {
    it('persiste payload, tentativas, erro e estado de sincronização', async () => {
      const repository = new SqliteSyncQueueRepository(driver);
      const action = new SyncAction({
        id: 'sync_1',
        operation: 'UPDATE',
        entityType: 'animal',
        entityId: 'a1',
        payload: { name: 'Luna', nested: { version: 2 } },
        changedAt: '2026-01-01T00:00:00.000Z',
      });

      await repository.enqueue(action);

      const loaded = await repository.findById('sync_1');
      expect(loaded!.payload).toEqual({ name: 'Luna', nested: { version: 2 } });
      expect(loaded!.attempts).toBe(0);
      expect(loaded!.status.isPending()).toBe(true);

      loaded!.markFailed('sem conexão');
      await repository.update(loaded!);

      const failed = await repository.findById('sync_1');
      expect(failed!.attempts).toBe(1);
      expect(failed!.status.isFailed()).toBe(true);
      expect(failed!.lastError).toBe('sem conexão');
      expect(await repository.listPending()).toHaveLength(1);
    });

    it('enqueue é idempotente por id e clearCompleted remove apenas concluídas', async () => {
      const repository = new SqliteSyncQueueRepository(driver);
      const action = new SyncAction({
        id: 'sync_1',
        operation: 'CREATE',
        entityType: 'animal',
        entityId: 'a1',
        payload: { name: 'Luna' },
      });
      await repository.enqueue(action);

      const updated = new SyncAction({
        id: 'sync_1',
        operation: 'CREATE',
        entityType: 'animal',
        entityId: 'a1',
        payload: { name: 'Luna Nova' },
        attempts: 2,
      });
      await repository.enqueue(updated);
      expect((await repository.findById('sync_1'))!.payload).toEqual({ name: 'Luna Nova' });
      expect((await repository.findById('sync_1'))!.attempts).toBe(2);

      const done = new SyncAction({
        id: 'sync_done',
        operation: 'DELETE',
        entityType: 'animal',
        entityId: 'a2',
        payload: {},
      });
      done.markCompleted();
      await repository.enqueue(done);

      expect((await repository.listPending()).map((a) => a.id)).toEqual(['sync_1']);
      await repository.clearCompleted();
      expect(await repository.findById('sync_done')).toBeNull();
      expect(await repository.findById('sync_1')).not.toBeNull();
    });
  });

  describe('SqlitePhotoStorage', () => {
    it('registra foto local, atualiza upload e remove o vínculo', async () => {
      const animals = new SqliteAnimalRepository(driver);
      const storage = new SqlitePhotoStorage(driver, false);
      const photo = makePhoto();

      await animals.saveLocal(makeAnimal({ photos: [photo] }));
      await storage.persistLocal(photo);

      expect((await storage.listPendingUpload()).map((p) => p.id)).toEqual(['photo_1']);

      const uploaded = await storage.uploadPending(photo);
      expect(uploaded.syncState.isCompleted()).toBe(true);
      expect(uploaded.remoteUrl).toContain('animal_1');

      const imageRow = await driver.getFirstAsync<Record<string, any>>(
        `SELECT * FROM local_images WHERE id = ?`,
        ['photo_1']
      );
      expect(imageRow!.upload_status).toBe('COMPLETED');
      expect(imageRow!.remote_url).toContain('animal_1');

      const photoRow = await driver.getFirstAsync<Record<string, any>>(
        `SELECT * FROM animal_photos WHERE id = ?`,
        ['photo_1']
      );
      expect(photoRow!.upload_status).toBe('COMPLETED');
      expect(photoRow!.remote_url).toContain('animal_1');

      await storage.remove('photo_1');
      expect(await storage.listPendingUpload()).toHaveLength(0);
    });

    it('foto apenas remota não cria registro em local_images', async () => {
      const storage = new SqlitePhotoStorage(driver, false);
      await storage.persistLocal(
        makePhoto({ id: 'remota', localPath: undefined, remoteUrl: 'https://cdn/p.jpg' })
      );
      expect(await driver.getAllAsync(`SELECT * FROM local_images`)).toHaveLength(0);
    });
  });

  describe('preferências e metadados', () => {
    it('search_preferences faz upsert por usuário', async () => {
      const repository = new SqliteSearchPreferencesRepository(driver);
      await repository.save('u1', { species: 'Cão', radiusKm: 10 });
      await repository.save('u1', { species: 'Gato', searchQuery: 'Mimi' });

      const prefs = await repository.findByUserId('u1');
      expect(prefs).toMatchObject({ species: 'Gato', searchQuery: 'Mimi' });
      expect(prefs!.radiusKm).toBeUndefined();
      expect(await driver.getAllAsync(`SELECT * FROM search_preferences`)).toHaveLength(1);
    });

    it('sync_state faz upsert por chave', async () => {
      const repository = new SqliteSyncMetadataRepository(driver);
      const metadata = new SyncMetadata({ key: 'global' });
      await repository.save(metadata);

      metadata.markSynced('2026-01-01T00:00:00.000Z');
      metadata.markSuccess('2026-01-01T00:00:01.000Z');
      await repository.save(metadata);

      const loaded = await repository.findByKey('global');
      expect(loaded!.lastSyncAt).toBe('2026-01-01T00:00:00.000Z');
      expect(loaded!.lastSuccessAt).toBe('2026-01-01T00:00:01.000Z');
      expect(await driver.getAllAsync(`SELECT * FROM sync_state`)).toHaveLength(1);
    });
  });
});
