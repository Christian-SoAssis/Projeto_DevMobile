import { Animal } from '../domain/entities/Animal';
import { AnimalPhoto } from '../domain/entities/AnimalPhoto';
import { User } from '../domain/entities/User';
import { AdoptionInterest } from '../domain/entities/AdoptionInterest';
import { SearchRadius } from '../domain/value-objects/SearchRadius';
import { ApproximateLocation } from '../domain/value-objects/ApproximateLocation';
import { AnimalCharacteristics } from '../domain/value-objects/AnimalCharacteristics';
import { AdoptionStatus } from '../domain/value-objects/AdoptionStatus';
import { ConflictResolutionService } from '../domain/services/ConflictResolutionService';
import { AccessPolicy } from '../domain/services/AccessPolicy';
import { InMemorySqliteDriver } from '../infrastructure/database/sqlite/DatabaseDriver';
import { loadAppContainer } from '../infrastructure/composition/loadAppContainer';
import { CreateAnimalUseCase } from '../application/use-cases/CreateAnimalUseCase';
import { SearchAnimalsUseCase } from '../application/use-cases/SearchAnimalsUseCase';

describe('Enlace Domain, Offline-First Use Cases & Multi-Account Isolation', () => {
  const sampleLocation = new ApproximateLocation({
    neighborhood: 'Vila Pinto',
    city: 'Varginha',
    latitude: -21.55,
    longitude: -45.43,
  });

  const sampleCharacteristics = new AnimalCharacteristics({
    species: 'Cão',
    size: 'Médio',
    approximateAge: '2 anos',
    sex: 'Fêmea',
    behavior: 'Dócil e companheira',
  });

  const samplePhoto = new AnimalPhoto({
    id: 'photo-1',
    animalId: 'animal-1',
    localPath: 'file:///amora.webp',
  });

  it('validates Animal invariants (up to 4 photos, required fields)', () => {
    const animal = new Animal({
      id: 'animal-1',
      ownerId: 'user-1',
      name: 'Amora',
      characteristics: sampleCharacteristics,
      location: sampleLocation,
      photos: [samplePhoto],
    });

    expect(animal.name).toBe('Amora');
    expect(animal.status.isAvailable()).toBe(true);

    expect(
      () =>
        new Animal({
          id: 'animal-2',
          ownerId: 'user-1',
          name: 'Excesso de Fotos',
          characteristics: sampleCharacteristics,
          location: sampleLocation,
          photos: [samplePhoto, samplePhoto, samplePhoto, samplePhoto, samplePhoto],
        })
    ).toThrow('no máximo 4 fotos');
  });

  it('enforces SearchRadius maximum 10 km limit (Decisão 14)', () => {
    expect(() => new SearchRadius(25)).toThrow('entre 0 e 10 km');
    const valid = new SearchRadius(5);
    expect(valid.km).toBe(5);
  });

  it('calculates Haversine approximate distance', () => {
    expect(sampleLocation.distanceKmTo(-21.56, -45.44)).toBeLessThan(5);
    expect(sampleLocation.distanceKmTo(-23.55, -46.63)).toBeGreaterThan(200);
  });

  it('manages the 4-stage AdoptionInterest pipeline (Decisão 18)', () => {
    const interest = new AdoptionInterest({
      id: 'int-1',
      animalId: 'animal-1',
      userId: 'adopter-1',
      message: 'Tenho quintal telado e experiência com cães.',
      contactInfo: '35999990000',
      userName: 'Carlos',
    });

    expect(interest.status).toBe('ENVIADA');
    interest.transitionTo('EM_ANALISE');
    expect(interest.status).toBe('EM_ANALISE');
    interest.transitionTo('VISITA_COMBINADA');
    expect(interest.status).toBe('VISITA_COMBINADA');
    interest.transitionTo('CONCLUIDA');
    expect(interest.status).toBe('CONCLUIDA');
  });

  it('enforces AccessPolicy ownership and ADMIN moderation rules', () => {
    const owner = new User({
      id: 'owner-1',
      name: 'Ana',
      email: 'ana@enlace.org',
      contactInfo: '35988887777',
      role: 'USER',
    });
    const stranger = new User({
      id: 'stranger-1',
      name: 'João',
      email: 'joao@enlace.org',
      contactInfo: '35977776666',
      role: 'USER',
    });
    const admin = new User({
      id: 'admin-1',
      name: 'Admin',
      email: 'admin@enlace.org',
      contactInfo: '35966665555',
      role: 'ADMIN',
    });

    const animal = new Animal({
      id: 'animal-1',
      ownerId: owner.id,
      name: 'Amora',
      characteristics: sampleCharacteristics,
      location: sampleLocation,
      photos: [samplePhoto],
    });

    expect(AccessPolicy.canManageAnimal(owner, animal)).toBe(true);
    expect(AccessPolicy.canManageAnimal(stranger, animal)).toBe(false);
    expect(AccessPolicy.canModerate(owner)).toBe(false);
    expect(AccessPolicy.canModerate(admin)).toBe(true);
  });

  it('detects manual review conflict when adoption status diverges (Decisão 15)', () => {
    const service = new ConflictResolutionService();
    const localAnimal = new Animal({
      id: 'animal-1',
      ownerId: 'user-1',
      name: 'Amora',
      characteristics: sampleCharacteristics,
      location: sampleLocation,
      photos: [samplePhoto],
      status: AdoptionStatus.available(),
      version: 1,
      updatedAt: '2026-11-15T10:00:00.000Z',
    });

    const remoteAnimal = new Animal({
      id: 'animal-1',
      ownerId: 'user-1',
      name: 'Amora',
      characteristics: sampleCharacteristics,
      location: sampleLocation,
      photos: [samplePhoto],
      status: AdoptionStatus.adopted(),
      version: 2,
      updatedAt: '2026-11-15T11:00:00.000Z',
    });

    const decision = service.evaluate(localAnimal, remoteAnimal);
    expect(decision.type).toBe('MANUAL_REVIEW_REQUIRED');
  });

  it('isolates offline pending creations by owner (DAT-10) in SQLite', async () => {
    const container = await loadAppContainer({
      driver: new InMemorySqliteDriver(),
      supabaseClient: null,
      imageProcessor: {
        toWebp: async (uri: string) => uri,
      },
    });

    const createUseCase = new CreateAnimalUseCase(
      container.animalRepository,
      container.syncQueueRepository,
      container.photoStorage,
      container.unitOfWork
    );
    const searchUseCase = new SearchAnimalsUseCase(
      container.animalRepository,
      container.syncQueueRepository
    );

    const offlinePet = new Animal({
      id: 'offline-pet-ana',
      ownerId: 'user-ana',
      name: 'Pipoca Offline Ana',
      characteristics: sampleCharacteristics,
      location: sampleLocation,
      photos: [
        new AnimalPhoto({
          animalId: 'offline-pet-ana',
          localPath: 'file:///pipoca.webp',
        }),
      ],
    });

    const created = await createUseCase.execute(offlinePet, false);
    expect(created.synced).toBe(false);

    // Ana sees her own unsynced animal
    const visibleToAna = await searchUseCase.execute({ currentUserId: 'user-ana' });
    expect(visibleToAna.some((a) => a.id === 'offline-pet-ana')).toBe(true);

    // Another user on the same device does NOT see Ana's unsynced draft (DAT-10)
    const visibleToCarlos = await searchUseCase.execute({ currentUserId: 'user-carlos' });
    expect(visibleToCarlos.some((a) => a.id === 'offline-pet-ana')).toBe(false);
  });
});
