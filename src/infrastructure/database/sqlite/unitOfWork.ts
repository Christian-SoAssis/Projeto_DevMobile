import type { Animal } from '../../../domain/entities/Animal';
import type { SyncAction } from '../../../domain/entities/SyncAction';
import type { TransactionRunner } from './connection';
import { SqliteAnimalRepository } from './repositories/SqliteAnimalRepository';
import { SqliteSyncQueueRepository } from './repositories/SqliteSyncQueueRepository';

// Transação anúncio + ação pendente (doc §16.3: "transação anúncio + ação
// pendente é atômica"). Tudo ou nada: se o `enqueue` falhar (ex.: id
// duplicado), o anúncio não permanece no cache — sem meia-escrita.

export async function saveAnimalWithPendingAction(
  runner: TransactionRunner,
  animal: Animal,
  action: SyncAction
): Promise<void> {
  await runner(async (txDb) => {
    await new SqliteAnimalRepository(txDb).saveLocal(animal);
    await new SqliteSyncQueueRepository(txDb).enqueue(action);
  });
}
