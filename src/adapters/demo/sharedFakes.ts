import { AnimalRepositoryFake } from '../../application/fakes/AnimalRepositoryFake';
import { FavoriteRepositoryFake } from '../../application/fakes/FavoriteRepositoryFake';
import { AdoptionInterestRepositoryFake } from '../../application/fakes/AdoptionInterestRepositoryFake';
import { SyncQueueRepositoryFake } from '../../application/fakes/SyncQueueRepositoryFake';
import { PhotoStorageFake } from '../../application/fakes/PhotoStorageFake';
import { buildSeedAnimals } from './seedAnimals';

/**
 * Usuário demo das rotas (não proprietário dos anúncios de terceiros,
 * portanto pode favoritar e demonstrar interesse).
 */
export const DEMO_USER_ID = 'usr_2';

/**
 * Persona responsável demo (proprietária dos anúncios seed anim_1, anim_2 e anim_7).
 * Usada nas telas de gestão para que criar → listar funcione no fluxo demo.
 */
export const DEMO_OWNER_ID = 'usr_1';

/**
 * Singletons de fakes compartilhados pelas rotas em `app/`.
 * Centraliza o seed para que uma ação (ex.: favoritar nos detalhes)
 * seja visível em todas as telas quando o app roda em modo demo.
 */
export const animalRepository = new AnimalRepositoryFake(buildSeedAnimals());
export const favoriteRepository = new FavoriteRepositoryFake();
export const interestRepository = new AdoptionInterestRepositoryFake();
export const syncQueueRepository = new SyncQueueRepositoryFake();

/**
 * Container demo (objetos tipados estruturalmente iguais a `AppContainer`,
 * sem importar a infraestrutura). Consumido por `useRepositories()` quando
 * o `RepositoriesProvider` não está montado (unit tests / rotas avulsas).
 */
export const demoContainer = {
  mode: 'demo' as const,
  animalRepository,
  favoriteRepository,
  interestRepository,
  syncQueueRepository,
  photoStorage: new PhotoStorageFake(),
};
