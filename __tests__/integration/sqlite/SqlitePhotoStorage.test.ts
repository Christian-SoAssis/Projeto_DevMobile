import { InMemorySqliteDriver } from '../../../src/infrastructure/database/sqlite/DatabaseDriver';
import { INITIAL_SCHEMA_SQL } from '../../../src/infrastructure/database/sqlite/migrations/schema.sql';
import { SqlitePhotoStorage } from '../../../src/infrastructure/database/sqlite/repositories/SqlitePhotoStorage';
import { AnimalPhoto } from '../../../src/domain/entities/AnimalPhoto';
import { SyncState } from '../../../src/domain/value-objects/SyncState';

describe('SqlitePhotoStorage — imagens locais registradas no SQLite (Fase 2)', () => {
  let db: InMemorySqliteDriver;
  let storage: SqlitePhotoStorage;

  beforeEach(async () => {
    db = new InMemorySqliteDriver();
    await db.execAsync(INITIAL_SCHEMA_SQL);
    // enableFileCopy=false: em Jest não há expo-file-system operante;
    // o endereço originado da câmera/galeria é registrado como está.
    storage = new SqlitePhotoStorage(db, false);
  });

  const rows = () => db.getAllAsync<Record<string, any>>('FROM local_images');

  it('persistLocal: registra o endereço local da foto na tabela local_images', async () => {
    const photo = new AnimalPhoto({
      id: 'p1',
      animalId: 'a1',
      localPath: 'file://tmp/p1.jpg',
    });

    await storage.persistLocal(photo);

    const all = await storage.listPendingUpload();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('p1');
    expect(all[0].animalId).toBe('a1');
    expect(all[0].localPath).toBe('file://tmp/p1.jpg');

    const raw = await rows();
    expect(raw[0].id).toBe('p1');
    expect(raw[0].animal_local_or_remote_id).toBe('a1');
    expect(raw[0].local_path).toBe('file://tmp/p1.jpg');
    expect(raw[0].upload_status).toBe('PENDING');
  });

  it('persistLocal: copiar a mesma foto de novo atualiza o endereço em vez de duplicar', async () => {
    const first = new AnimalPhoto({
      id: 'p1',
      animalId: 'a1',
      localPath: 'file://tmp/p1.jpg',
    });
    await storage.persistLocal(first);

    const again = new AnimalPhoto({
      id: 'p1',
      animalId: 'a1',
      localPath: 'file://tmp/p1-moved.jpg',
    });
    await storage.persistLocal(again);

    const raw = await rows();
    expect(raw).toHaveLength(1);
    expect(raw[0].local_path).toBe('file://tmp/p1-moved.jpg');
  });

  it('persistLocal: com cópia habilitada, sem FileSystem operante registra o endereço original (degradação segura)', async () => {
    // enableFileCopy=true (default em device): em Jest o require dinâmico do
    // expo-file-system não resolve uma cópia operante e o adapter degrada
    // para o endereço original, sem perder o vínculo foto ↔ anúncio.
    const storageComCopia = new SqlitePhotoStorage(db, true);
    const photo = new AnimalPhoto({
      id: 'p9',
      animalId: 'a9',
      localPath: 'file://tmp/p9.jpg',
    });

    await storageComCopia.persistLocal(photo);

    const all = await storageComCopia.listPendingUpload();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('p9');
    expect(all[0].localPath).toBeTruthy();
  });

  it('listPendingUpload: lista apenas fotos PENDING e FAILED (suporte a retry, RF21)', async () => {
    await storage.persistLocal(
      new AnimalPhoto({ id: 'p1', animalId: 'a1', localPath: 'file://p1.jpg' })
    );
    await storage.persistLocal(
      new AnimalPhoto({
        id: 'p2',
        animalId: 'a1',
        localPath: 'file://p2.jpg',
        syncState: SyncState.failed(),
      })
    );
    await storage.persistLocal(
      new AnimalPhoto({ id: 'p3', animalId: 'a2', remoteUrl: 'https://remoto/p3.jpg' })
    );

    const pending = await storage.listPendingUpload();
    expect(pending.map((p) => p.id).sort()).toEqual(['p1', 'p2']);
  });

  it('uploadPending: grava URL remota e estado COMPLETED (upload antes do reconcile, §14.1)', async () => {
    const photo = new AnimalPhoto({
      id: 'p1',
      animalId: 'a1',
      localPath: 'file://p1.jpg',
    });
    await storage.persistLocal(photo);

    const reconciled = await storage.uploadPending(photo);

    expect(reconciled.syncState.isCompleted()).toBe(true);
    expect(reconciled.remoteUrl).toContain('a1');
    expect(await storage.listPendingUpload()).toHaveLength(0);

    const raw = await rows();
    expect(raw[0].remote_url).toContain('a1');
    expect(raw[0].upload_status).toBe('COMPLETED');
  });

  it('uploadPending: não perde o endereço local — foto sobe para o ramo remoto mas continua registrada', async () => {
    const photo = new AnimalPhoto({
      id: 'p1',
      animalId: 'a1',
      localPath: 'file://p1.jpg',
    });
    await storage.persistLocal(photo);
    await storage.uploadPending(photo);

    const rowsAfter = await rows();
    expect(rowsAfter[0].local_path).toBe('file://p1.jpg');
    expect(rowsAfter[0].remote_url).toContain('a1');
  });

  it('uploadPending: usa a URL remota já marcada na entidade (fluxo com reconcile previo)', async () => {
    const photo = new AnimalPhoto({
      id: 'p1',
      animalId: 'a1',
      localPath: 'file://p1.jpg',
    });
    await storage.persistLocal(photo);
    photo.markUploaded('https://storage.supabase/a1/p1.jpg');

    const reconciled = await storage.uploadPending(photo);
    expect(reconciled.remoteUrl).toBe('https://storage.supabase/a1/p1.jpg');

    const rowsAfter = await rows();
    expect(rowsAfter[0].remote_url).toBe('https://storage.supabase/a1/p1.jpg');
    expect(rowsAfter[0].upload_status).toBe('COMPLETED');
  });

  it('remove: apaga o registro da foto do SQLite', async () => {
    await storage.persistLocal(
      new AnimalPhoto({ id: 'p1', animalId: 'a1', localPath: 'file://p1.jpg' })
    );

    await storage.remove('p1');

    const all = await db.getAllAsync<Record<string, any>>('FROM local_images');
    expect(all).toHaveLength(0);
    await expect(storage.listPendingUpload()).resolves.toHaveLength(0);
  });
});
