import { Animal } from '../../domain/entities/Animal';
import { AnimalCharacteristics } from '../../domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../domain/value-objects/ApproximateLocation';
import { AnimalRepositoryFake } from '../../application/fakes/AnimalRepositoryFake';
import { FavoriteRepositoryFake } from '../../application/fakes/FavoriteRepositoryFake';
import { AdoptionInterestRepositoryFake } from '../../application/fakes/AdoptionInterestRepositoryFake';
import { SyncQueueRepositoryFake } from '../../application/fakes/SyncQueueRepositoryFake';

/**
 * Usuário demo das rotas (não proprietário dos anúncios seed,
 * portanto pode favoritar e demonstrar interesse).
 */
export const DEMO_USER_ID = 'usr_2';

/**
 * Persona responsável demo (proprietária dos anúncios seed).
 * Usada nas telas de gestão para que criar → listar funcione no fluxo demo.
 */
export const DEMO_OWNER_ID = 'usr_1';

function buildSeedAnimals(): Animal[] {
  return [
    new Animal({
      id: 'anim_1',
      ownerId: 'usr_1',
      name: 'Luna',
      characteristics: new AnimalCharacteristics({
        species: 'Cão',
        size: 'Médio',
        approximateAge: '2 anos',
        sex: 'Fêmea',
        behavior: 'Dócil e brincalhona',
      }),
      location: new ApproximateLocation({
        latitude: -21.554,
        longitude: -45.435,
        neighborhood: 'Centro',
        city: 'Varginha',
        region: 'MG',
      }),
    }),
    new Animal({
      id: 'anim_2',
      ownerId: 'usr_1',
      name: 'Mingau',
      characteristics: new AnimalCharacteristics({
        species: 'Gato',
        size: 'Pequeno',
        approximateAge: '1 ano',
        sex: 'Macho',
        behavior: 'Calmo e carinhoso',
      }),
      location: new ApproximateLocation({
        latitude: -21.56,
        longitude: -45.44,
        neighborhood: 'Vila Paiva',
        city: 'Varginha',
        region: 'MG',
      }),
    }),
  ];
}

/**
 * Singletons de fakes compartilhados pelas rotas em `app/`.
 * Centraliza o seed para que uma ação (ex.: favoritar nos detalhes)
 * seja visível em todas as telas durante a demo.
 */
export const animalRepository = new AnimalRepositoryFake(buildSeedAnimals());
export const favoriteRepository = new FavoriteRepositoryFake();
export const interestRepository = new AdoptionInterestRepositoryFake();
export const syncQueueRepository = new SyncQueueRepositoryFake();
