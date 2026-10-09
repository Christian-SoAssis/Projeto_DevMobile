import { Animal } from '../../../../domain/entities/Animal';
import { AnimalPhoto } from '../../../../domain/entities/AnimalPhoto';
import { AnimalRepository, AnimalFilterOptions } from '../../../../domain/ports/AnimalRepository';
import { AdoptionStatus } from '../../../../domain/value-objects/AdoptionStatus';
import { AnimalCharacteristics } from '../../../../domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../../../domain/value-objects/ApproximateLocation';
import { SqliteDatabaseDriver } from '../DatabaseDriver';

interface AnimalRow {
  id: string;
  owner_id: string;
  name: string;
  species: string;
  size: string;
  approximate_age: string;
  sex: string;
  description: string;
  health_notes: string;
  special_care: string;
  status: string;
  neighborhood: string;
  city: string;
  region: string;
  latitude: number;
  longitude: number;
  created_at: string;
  updated_at: string;
  version: number;
}

interface PhotoRow {
  id: string;
  animal_id: string;
  local_path: string | null;
  remote_url: string | null;
  upload_status: string;
  created_at: string;
}

export class SqliteAnimalRepository implements AnimalRepository {
  constructor(private db: SqliteDatabaseDriver) {}

  async findById(id: string): Promise<Animal | null> {
    const row = await this.db.getFirstAsync<AnimalRow>(
      'SELECT * FROM animals WHERE id = ?',
      [id]
    );
    if (!row) return null;

    const photos = await this.loadPhotosForAnimal(id);
    return this.mapToEntity(row, photos);
  }

  async search(filters: AnimalFilterOptions): Promise<Animal[]> {
    const allRows = await this.db.getAllAsync<AnimalRow>('SELECT * FROM animals');

    let filtered = allRows;

    if (filters.species) {
      filtered = filtered.filter((r) => r.species.toLowerCase() === filters.species!.toLowerCase());
    }
    if (filters.size) {
      filtered = filtered.filter((r) => r.size.toLowerCase() === filters.size!.toLowerCase());
    }
    if (filters.sex) {
      filtered = filtered.filter((r) => r.sex.toLowerCase() === filters.sex!.toLowerCase());
    }
    if (filters.approximateAge) {
      filtered = filtered.filter((r) => r.approximate_age.toLowerCase() === filters.approximateAge!.toLowerCase());
    }
    if (filters.ownerId) {
      filtered = filtered.filter((r) => r.owner_id === filters.ownerId);
    }
    if (filters.status) {
      filtered = filtered.filter((r) => r.status === filters.status);
    }
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.city.toLowerCase().includes(q) ||
          r.neighborhood.toLowerCase().includes(q)
      );
    }

    const animals: Animal[] = [];
    for (const r of filtered) {
      const photos = await this.loadPhotosForAnimal(r.id);
      animals.push(this.mapToEntity(r, photos));
    }

    return animals;
  }

  async saveLocal(animal: Animal): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `INSERT INTO animals (
          id, owner_id, name, species, size, approximate_age, sex, description,
          health_notes, special_care, status, neighborhood, city, region,
          latitude, longitude, created_at, updated_at, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          animal.id,
          animal.ownerId,
          animal.name,
          animal.characteristics.species,
          animal.characteristics.size,
          animal.characteristics.approximateAge,
          animal.characteristics.sex,
          animal.characteristics.characteristics || '',
          animal.characteristics.behavior || '',
          animal.characteristics.specialCare || 'Nenhum',
          animal.status.value,
          animal.location.neighborhood,
          animal.location.city,
          animal.location.region,
          animal.location.latitude,
          animal.location.longitude,
          animal.createdAt,
          animal.updatedAt,
          animal.version,
        ]
      );

      for (const photo of animal.photos) {
        await this.db.runAsync(
          `INSERT INTO animal_photos (
            id, animal_id, local_path, remote_url, upload_status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            photo.id,
            animal.id,
            photo.localPath || null,
            photo.remoteUrl || null,
            photo.syncState.value,
            photo.createdAt,
          ]
        );
      }
    });
  }

  async createRemote(animal: Animal): Promise<Animal> {
    await this.saveLocal(animal);
    return animal;
  }

  async updateRemote(animal: Animal): Promise<Animal> {
    await this.db.runAsync(
      `UPDATE animals SET
        name = ?, species = ?, size = ?, approximate_age = ?, sex = ?,
        status = ?, neighborhood = ?, city = ?, region = ?,
        latitude = ?, longitude = ?, updated_at = ?, version = ?
       WHERE id = ?`,
      [
        animal.name,
        animal.characteristics.species,
        animal.characteristics.size,
        animal.characteristics.approximateAge,
        animal.characteristics.sex,
        animal.status.value,
        animal.location.neighborhood,
        animal.location.city,
        animal.location.region,
        animal.location.latitude,
        animal.location.longitude,
        animal.updatedAt,
        animal.version,
        animal.id,
      ]
    );
    return animal;
  }

  async deleteRemote(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM animals WHERE id = ?', [id]);
    await this.db.runAsync('DELETE FROM animal_photos WHERE animal_id = ?', [id]);
  }

  async listByOwner(ownerId: string): Promise<Animal[]> {
    return this.search({ ownerId });
  }

  async upsertCache(animals: Animal[]): Promise<void> {
    for (const animal of animals) {
      const existing = await this.findById(animal.id);
      if (existing) {
        await this.updateRemote(animal);
      } else {
        await this.saveLocal(animal);
      }
    }
  }

  private async loadPhotosForAnimal(animalId: string): Promise<AnimalPhoto[]> {
    const rows = await this.db.getAllAsync<PhotoRow>(
      'SELECT * FROM animal_photos WHERE animal_id = ?',
      [animalId]
    );

    return rows.map(
      (r) =>
        new AnimalPhoto({
          id: r.id,
          animalId: r.animal_id,
          localPath: r.local_path || undefined,
          remoteUrl: r.remote_url || undefined,
          createdAt: r.created_at,
        })
    );
  }

  private mapToEntity(row: AnimalRow, photos: AnimalPhoto[]): Animal {
    return new Animal({
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      characteristics: new AnimalCharacteristics({
        species: row.species,
        size: row.size,
        approximateAge: row.approximate_age,
        sex: row.sex,
        characteristics: row.description,
        behavior: row.health_notes,
        specialCare: row.special_care,
      }),
      status: row.status === 'ADOPTED' ? AdoptionStatus.adopted() : AdoptionStatus.available(),
      location: new ApproximateLocation({
        neighborhood: row.neighborhood,
        city: row.city,
        region: row.region,
        latitude: row.latitude,
        longitude: row.longitude,
      }),
      photos,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      version: row.version,
    });
  }
}
