import { Animal } from '../../src/domain/entities/Animal';
import { MAX_PHOTOS_PER_ANIMAL } from '../../src/domain/entities/Animal';
import { makeAnimal, makePhoto } from '../../test-support/fixtures';

/**
 * Decisão de produto (§19): LIMITE DE 4 FOTOS por anúncio, enforce no
 * agregado — nem a UI nem os adaptadores podem gravar mais que isso.
 */
describe('Limite de fotos por anúncio (máximo 4)', () => {
  const noveFotos = Array.from({ length: 5 }, (_, i) =>
    makePhoto({ id: `p_${i}`, animalId: 'animal_1' })
  );

  it('construtor: mais de 4 fotos no agregado é recusado', () => {
    expect(() => makeAnimal({ photos: noveFotos })).toThrow(
      `Máximo de ${MAX_PHOTOS_PER_ANIMAL} fotos por anúncio.`
    );
  });

  it('constructor: exatamente 4 fotos é aceito', () => {
    const four = noveFotos.slice(0, 4);
    expect(() => makeAnimal({ photos: four })).not.toThrow();
  });

  it('addPhoto: a 5ª foto com o anúncio cheio é recusada', () => {
    const animal = makeAnimal({ photos: noveFotos.slice(0, 4) });
    expect(animal.photos.length).toBe(4);
    expect(() => animal.addPhoto(makePhoto({ id: 'p_5', animalId: 'animal_1' }))).toThrow(
      `Máximo de ${MAX_PHOTOS_PER_ANIMAL} fotos por anúncio.`
    );
  });

  it('setPhotos: lista acima do limite é recusada; dentro do limite substitui tudo', () => {
    const animal = makeAnimal();
    const extra = makePhoto({ id: 'extra', animalId: 'animal_1' });

    expect(() => animal.setPhotos('user_1', noveFotos)).toThrow(
      `Máximo de ${MAX_PHOTOS_PER_ANIMAL} fotos por anúncio.`
    );

    animal.setPhotos('user_1', [extra]);
    expect(animal.photos[0].id).toBe('extra');
  });

  it('setPhotos: foto de outro animal continua sendo recusada', () => {
    const animal = makeAnimal();
    const alheia = makePhoto({ id: 'alheia', animalId: 'animal_9' });
    expect(() => animal.setPhotos('user_1', [alheia])).toThrow('Foto não pertence a este animal.');
  });

  it('addPhoto dentro do limite acrescenta e mantém a ordem', () => {
    const animal: Animal = makeAnimal({ photos: noveFotos.slice(0, 2) });
    animal.addPhoto(makePhoto({ id: 'p_extra', animalId: 'animal_1' }));
    expect(animal.photos.map((p) => p.id)).toEqual(['p_0', 'p_1', 'p_extra']);
  });
});
