import { Animal } from '../../../../domain/entities/Animal';
import { AnimalPhoto } from '../../../../domain/entities/AnimalPhoto';
import { AdoptionStatus, AdoptionStatusType } from '../../../../domain/value-objects/AdoptionStatus';
import { AnimalCharacteristics } from '../../../../domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../../../domain/value-objects/ApproximateLocation';
import { SyncState, SyncStateType } from '../../../../domain/value-objects/SyncState';
import { AnimalRepository, AnimalSearchCriteria } from '../../../../domain/ports/AnimalRepository';
import { SqliteDatabaseDriver } from '../DatabaseDriver';

interface AnimalRow {
  id: string;
  owner_id: string;
  name: string;
  species: string;
  size: string;
  approximate_age: string;
  sex: string;
  characteristics: string;
  behavior: string;
  special_care: string;
  status: string;
  neighborhood: string;
  city: string;
  region: string;
  latitude: number;
  longitude: number;
  hidden: number;
  version: number;
  created_at: string;
  updated_at: string;
}

interface PhotoRow {
  id: string;
  animal_id: string;
  local_path: string | null;
  remote_url: string | null;
  upload_status: string;
  sort_order: number;
  created_at: string;
}

export class SqliteAnimalRepository implements AnimalRepository {
  constructor(private db: SqliteDatabaseDriver) {}

  async search(criteria: AnimalSearchCriteria = {}): Promise<Animal[]> {
    const rows = await this.db.getAllAsync<AnimalRow>('SELECT * FROM animals');
    const allAnimals: Animal[] = [];

    for (const row of rows) {
      if (!criteria.includeHidden && row.hidden === 1) continue;
      if (criteria.status && row.status !== criteria.status) continue;
      if (criteria.ownerId && row.owner_id !== criteria.ownerId) continue;
      if (
        criteria.species &&
        criteria.species !== 'Todos' &&
        row.species.toLowerCase() !== criteria.species.toLowerCase()
      ) {
        continue;
      }
      if (
        criteria.size &&
        criteria.size !== 'Todos' &&
        row.size.toLowerCase() !== criteria.size.toLowerCase()
      ) {
        continue;
      }
      if (
        criteria.sex &&
        criteria.sex !== 'Todos' &&
        row.sex.toLowerCase() !== criteria.sex.toLowerCase()
      ) {
        continue;
      }
      if (criteria.approximateAge && criteria.approximateAge.trim()) {
        const needle = criteria.approximateAge.trim().toLowerCase();
        if (!row.approximate_age.toLowerCase().includes(needle)) continue;
      }
      if (criteria.query && criteria.query.trim()) {
        const q = criteria.query.trim().toLowerCase();
        const matchesQuery =
          row.name.toLowerCase().includes(q) ||
          row.city.toLowerCase().includes(q) ||
          row.neighborhood.toLowerCase().includes(q) ||
          row.species.toLowerCase().includes(q);
        if (!matchesQuery) continue;
      }

      const animal = await this.hydrateAnimal(row);
      if (
        criteria.maxDistanceKm !== undefined &&
        criteria.latitude !== undefined &&
        criteria.longitude !== undefined
      ) {
        const dist = animal.location.distanceKmTo(criteria.latitude, criteria.longitude);
        if (dist > criteria.maxDistanceKm) continue;
      }

      allAnimals.push(animal);
    }

    return allAnimals.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
  }

  async findById(id: string): Promise<Animal | null> {
    const row = await this.db.getFirstAsync<AnimalRow>('SELECT * FROM animals WHERE id = ?', [id]);
    if (!row) return null;
    return this.hydrateAnimal(row);
  }

  async findByOwner(ownerId: string): Promise<Animal[]> {
    return this.search({ ownerId, includeHidden: true });
  }

  async saveLocal(animal: Animal): Promise<void> {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO animals (
        id, owner_id, name, species, size, approximate_age, sex,
        characteristics, behavior, special_care, status,
        neighborhood, city, region, latitude, longitude,
        hidden, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        animal.id,
        animal.ownerId,
        animal.name,
        animal.characteristics.species,
        animal.characteristics.size,
        animal.characteristics.approximateAge,
        animal.characteristics.sex,
        animal.characteristics.characteristics,
        animal.characteristics.behavior,
        animal.characteristics.specialCare,
        animal.status.value,
        animal.location.neighborhood,
        animal.location.city,
        animal.location.region,
        animal.location.latitude,
        animal.location.longitude,
        animal.hidden ? 1 : 0,
        animal.version,
        animal.createdAt,
        animal.updatedAt,
      ]
    );

    await this.db.runAsync('DELETE FROM animal_photos WHERE animal_id = ?', [animal.id]);
    const photos = animal.photos;
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      await this.db.runAsync(
        `INSERT OR REPLACE INTO animal_photos (
          id, animal_id, local_path, remote_url, upload_status, sort_order, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          photo.id,
          animal.id,
          photo.localPath ?? null,
          photo.remoteUrl ?? null,
          photo.syncState.value,
          i,
          photo.createdAt,
        ]
      );
    }
  }

  async upsertCache(animals: Animal[]): Promise<void> {
    for (const animal of animals) {
      // Preserva localPath de fotos locais já existentes no dispositivo
      const existing = await this.findById(animal.id);
      if (existing) {
        const localByPhotoId = new Map(existing.photos.map((p) => [p.id, p.localPath]));
        const mergedPhotos = animal.photos.map(
          (p) =>
            new AnimalPhoto({
              id: p.id,
              animalId: p.animalId,
              localPath: p.localPath ?? localByPhotoId.get(p.id),
              remoteUrl: p.remoteUrl,
              syncState: p.syncState,
              createdAt: p.createdAt,
            })
        );
        animal.setPhotos(mergedPhotos);
      }
      await this.saveLocal(animal);
    }
  }

  async deleteLocal(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM animal_photos WHERE animal_id = ?', [id]);
    await this.db.runAsync('DELETE FROM animals WHERE id = ?', [id]);
  }

  private async hydrateAnimal(row: AnimalRow): Promise<Animal> {
    const photoRows = await this.db.getAllAsync<PhotoRow>(
      'SELECT * FROM animal_photos WHERE animal_id = ?',
      [row.id]
    );
    photoRows.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    const photos = photoRows
      .filter((p) => Boolean(p.local_path || p.remote_url))
      .map(
        (p) =>
          new AnimalPhoto({
            id: p.id,
            animalId: p.animal_id,
            localPath: p.local_path ?? undefined,
            remoteUrl: p.remote_url ?? undefined,
            syncState: new SyncState((p.upload_status as SyncStateType) || 'COMPLETED'),
            createdAt: p.created_at,
          })
      );

    return new Animal({
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      characteristics: new AnimalCharacteristics({
        species: row.species,
        size: row.size,
        approximateAge: row.approximate_age,
        sex: row.sex,
        characteristics: row.characteristics,
        behavior: row.behavior,
        specialCare: row.special_care,
      }),
      location: new ApproximateLocation({
        neighborhood: row.neighborhood,
        city: row.city,
        region: row.region,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
      }),
      status: new AdoptionStatus((row.status as AdoptionStatusType) || 'AVAILABLE'),
      photos,
      hidden: row.hidden === 1,
      version: Number(row.version) || 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
