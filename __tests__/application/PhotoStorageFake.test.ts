import { PhotoStorageFake } from '../../src/application/fakes/PhotoStorageFake';
import { AnimalPhoto } from '../../src/domain/entities/AnimalPhoto';
import { SyncState } from '../../src/domain/value-objects/SyncState';

describe('PhotoStorageFake (in-memory)', () => {
  const makePhoto = (id: string, animalId = 'a1') =>
    new AnimalPhoto({ id, animalId, localPath: `file://${id}.jpg` });

  it('deve persistir foto local e listá-la como pendente de upload', async () => {
    const storage = new PhotoStorageFake();
    const photo = makePhoto('p1');

    await storage.persistLocal(photo);

    const pending = await storage.listPendingUpload();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe('p1');
  });

  it('deve reconciliar a foto ao simular upload (URL remota + estado concluído)', async () => {
    const storage = new PhotoStorageFake();
    const photo = makePhoto('p2');
    await storage.persistLocal(photo);

    const reconciled = await storage.uploadPending(photo);

    expect(reconciled.remoteUrl).toBe('https://storage.fake/a1/p2.jpg');
    expect(reconciled.syncState.isCompleted()).toBe(true);
    expect(await storage.listPendingUpload()).toHaveLength(0);
  });

  it('deve remover foto do armazenamento', async () => {
    const storage = new PhotoStorageFake();
    await storage.persistLocal(makePhoto('p3'));

    await storage.remove('p3');

    expect(await storage.listPendingUpload()).toHaveLength(0);
  });

  it('deve listar como pendente a foto com falha anterior (suporte a retry)', async () => {
    const storage = new PhotoStorageFake();
    const photo = new AnimalPhoto({
      id: 'p4',
      animalId: 'a1',
      localPath: 'file://p4.jpg',
      syncState: SyncState.failed(),
    });
    await storage.persistLocal(photo);

    const pending = await storage.listPendingUpload();
    expect(pending.map((p) => p.id)).toContain('p4');
  });
});
