import { AdoptionInterest } from '../../../src/domain/entities/AdoptionInterest';
import { InterestStatus } from '../../../src/domain/value-objects/InterestStatus';
import { InMemorySqliteDriver } from '../../../src/infrastructure/database/sqlite/DatabaseDriver';
import { applyMigrations } from '../../../src/infrastructure/database/sqlite/migrations';
import { SqliteAdoptionInterestRepository } from '../../../src/infrastructure/database/sqlite/repositories/SqliteAdoptionInterestRepository';

describe('SqliteAdoptionInterestRepository', () => {
  let db: InMemorySqliteDriver;
  let repository: SqliteAdoptionInterestRepository;

  beforeEach(async () => {
    db = new InMemorySqliteDriver();
    // Caminho REAL do app: schema + migrações (a 4º cria updated_at/app_state).
    await applyMigrations(db);
    repository = new SqliteAdoptionInterestRepository(db);
  });

  it('registra e consulta manifestações de interesse de adoção', async () => {
    const interest = new AdoptionInterest('int_1', 'u1', 'a1');
    await repository.registerInterest(interest);

    expect(await repository.hasInterest('u1', 'a1')).toBe(true);
    expect(await repository.hasInterest('u1', 'a2')).toBe(false);

    const userInterests = await repository.listByUser('u1');
    expect(userInterests).toHaveLength(1);
    expect(userInterests[0].animalId).toBe('a1');
    expect(userInterests[0].status.value).toBe('ENVIADA');

    const animalInterests = await repository.listByAnimal('a1');
    expect(animalInterests).toHaveLength(1);
    expect(animalInterests[0].userId).toBe('u1');
  });

  it('trilha: status persiste e o legado PENDING lê como ENVIADA (decisão 18)', async () => {
    const interest = new AdoptionInterest('int_2', 'u3', 'a8');
    await repository.registerInterest(interest);

    // Linha "antiga" gravada pelo schema legado (status default PENDING):
    // escrita real do driver (UPDATE) para reproduzir o estado.
    await db.runAsync(
      `UPDATE adoption_interests SET status = ? WHERE id = ?`,
      ['PENDING', 'int_2']
    );

    const legacy = await repository.listByUser('u3');
    expect(legacy[0].status.value).toBe('ENVIADA'); // mapeamento legado

    await repository.updateStatus('int_2', InterestStatus.visitaCombinada(), '2026-11-08T09:00:00.000Z');

    const afterUpdate = (await repository.listByAnimal('a8'))[0];
    expect(afterUpdate.status.value).toBe('VISITA_COMBINADA');
    expect(afterUpdate.updatedAt).toBe('2026-11-08T09:00:00.000Z');
  });

  it('updateStatus em linha inexistente localmente é no-op (intenção vai pelo servidor)', async () => {
    await repository.updateStatus('fantasma', InterestStatus.concluida(), '2026-11-08T10:00:00.000Z');
    expect(await repository.listByUser('qualquer')).toHaveLength(0);
  });
});
