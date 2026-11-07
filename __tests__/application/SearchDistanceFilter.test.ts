import { SearchAnimalsUseCase } from '../../src/application/use-cases/SearchAnimalsUseCase';
import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { makeAnimal, makeCharacteristics, makeLocation } from '../../test-support/fixtures';

/**
 * RF04 (distância, decisão §4): a busca filtra anúncios por distância a
 * partir de uma origem aproximada, com raio 0–10 km (`SearchRadius`;
 * 0 = sem raio ativo, sem filtro). UC01-A3: sem posição atual, a busca
 * simplesmente não aplica o filtro — nunca quebra.
 */

const ORIGIN = { latitude: -21.554, longitude: -45.43 };
/** 0,01° ao norte da origem ≈ 1,11 km. */
const perto = makeAnimal({
  id: 'perto',
  name: 'Luna',
  location: makeLocation({ latitude: -21.564 }),
});
/** 0,5° ao norte ≈ 55 km: fora de qualquer raio do RF04. */
const longe = makeAnimal({
  id: 'longe',
  name: 'Thor',
  location: makeLocation({ latitude: -21.054, city: 'São Paulo' }),
});

function setup() {
  const repository = new AnimalRepositoryFake([perto, longe]);
  return { repository, useCase: new SearchAnimalsUseCase(repository) };
}

describe('SearchAnimalsUseCase — filtro por distância (RF04)', () => {
  it('raio de 5 km a partir da origem mantém só o anúncio próximo', async () => {
    const { useCase } = setup();

    const res = await useCase.execute({ origin: ORIGIN, radiusKm: 5 });

    expect(res.animals.map((a) => a.id)).toEqual(['perto']);
  });

  it('existe em raio de 60+ km? não — 50 km (máx. da faixa) já exclui o anúncio longe', async () => {
    // Inversão consciente da faixa: raio é recusado acima de 10 km, mas o
    // teste co-irma do domínio garante a recusa; aqui 10 km deve excluir um
    // anúncio a ~55 km.
    const { useCase } = setup();

    const res = await useCase.execute({ origin: ORIGIN, radiusKm: 10 });

    expect(res.animals.map((a) => a.id)).toEqual(['perto']);
  });

  it('raio 0 = sem raio ativo: nenhum filtro de distância', async () => {
    const { useCase } = setup();

    const res = await useCase.execute({ origin: ORIGIN, radiusKm: 0 });

    expect(res.animals.map((a) => a.id).sort()).toEqual(['longe', 'perto']);
  });

  it('sem origem não há o que medir: filtro não entra', async () => {
    const { useCase } = setup();

    const comRaio = await useCase.execute({ radiusKm: 5 });
    const semRaio = await useCase.execute({});

    expect(comRaio.animals).toHaveLength(2);
    expect(semRaio.animals).toHaveLength(2);
  });

  it('raio fora da faixa (ex.: preferência antiga gravada sem validação) é ignorado, sem quebrar a busca', async () => {
    const { useCase } = setup();

    const res = await useCase.execute({ origin: ORIGIN, radiusKm: 55 });

    expect(res.animals.map((a) => a.id).sort()).toEqual(['longe', 'perto']);
  });

  it('distância compõe com os demais filtros', async () => {
    const repository = new AnimalRepositoryFake([
      perto, // Luna (Cão, user_1)
      makeAnimal({
        id: 'perto_gato',
        name: 'Mel',
        characteristics: makeCharacteristics({ species: 'Gato' }),
        location: makeLocation({ latitude: -21.564 }),
      }),
      makeAnimal({
        id: 'perto_outro',
        name: 'Bob',
        location: makeLocation({ latitude: -21.564 }),
        ownerId: 'user_9',
      }),
    ]);
    const useCase = new SearchAnimalsUseCase(repository);

    const res = await useCase.execute({
      species: 'Gato',
      ownerId: 'user_1',
      origin: ORIGIN,
      radiusKm: 5,
    });

    expect(res.animals.map((a) => a.id)).toEqual(['perto_gato']);
  });
});
