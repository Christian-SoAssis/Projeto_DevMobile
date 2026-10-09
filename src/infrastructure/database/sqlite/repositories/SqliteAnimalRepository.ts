import { and, asc, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { Animal } from '../../../../domain/entities/Animal';
import { AnimalPhoto } from '../../../../domain/entities/AnimalPhoto';
import type { AnimalFilterOptions, AnimalRepository } from '../../../../domain/ports/AnimalRepository';
import type { AppDatabase } from '../connection';
import { animalPhotos, animals } from '../schema';
import { animalToRow, photoToRow, rowToAnimal, rowToPhoto } from '../mappers';

const REMOTE_UNAVAILABLE =
  'Remoto indisponível na Fase 2 (somente cache local). Sincronização remota é Fase 3/6.';

// Semântica de busca espelha `AnimalRepositoryFake.search`: exatos
// espécie/porte/sexo (case-insensitive), idade por conteúdo, texto por
// nome/cidade/bairro, proprietário e status exatos.
export class SqliteAnimalRepository implements AnimalRepository {
  constructor(private readonly db: AppDatabase) {}

  private async loadPhotos(animalIds: string[]): Promise<Map<string, AnimalPhoto[]>> {
    const grouped = new Map<string, AnimalPhoto[]>();
    if (animalIds.length === 0) return grouped;
    const rows = await this.db
      .select()
      .from(animalPhotos)
      .where(inArray(animalPhotos.animalId, animalIds))
      .orderBy(asc(animalPhotos.sortOrder), asc(animalPhotos.id));
    for (const row of rows) {
      const list = grouped.get(row.animalId) ?? [];
      list.push(rowToPhoto(row));
      grouped.set(row.animalId, list);
    }
    return grouped;
  }

  async findById(id: string): Promise<Animal | null> {
    const rows = await this.db.select().from(animals).where(eq(animals.id, id)).limit(1);
    if (rows.length === 0) return null;
    const photos = (await this.loadPhotos([id])).get(id) ?? [];
    return rowToAnimal(rows[0], photos);
  }

  async search(filters: AnimalFilterOptions): Promise<Animal[]> {
    const conditions: SQL[] = [];
    if (filters.species) {
      conditions.push(sql`${animals.species} = ${filters.species} COLLATE NOCASE`);
    }
    if (filters.size) {
      conditions.push(sql`${animals.size} = ${filters.size} COLLATE NOCASE`);
    }
    if (filters.sex) {
      conditions.push(sql`${animals.sex} = ${filters.sex} COLLATE NOCASE`);
    }
    if (filters.approximateAge) {
      conditions.push(sql`instr(lower(${animals.approximateAge}), ${filters.approximateAge.toLowerCase()}) > 0`);
    }
    if (filters.ownerId) {
      conditions.push(eq(animals.ownerId, filters.ownerId));
    }
    if (filters.status) {
      conditions.push(eq(animals.adoptionStatus, filters.status));
    }
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      const textMatch = or(
        sql`instr(lower(${animals.name}), ${q}) > 0`,
        sql`instr(lower(${animals.city}), ${q}) > 0`,
        sql`instr(lower(${animals.neighborhood}), ${q}) > 0`
      );
      if (textMatch) conditions.push(textMatch);
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    // COLLATE NOCASE dobra apenas ASCII: cobre os vocabulários controlados
    // ('cão'/'Cão', 'GATO'/'Gato') — entrada canônica vem dos chips da UI.
    // Formas totalmente maiúsculas com acento ('CÃO') não dobram no SQLite
    // sem ICU; o fake em memória (JS) é Unicode-aware — divergência conhecida
    // e documentada, sem impacto nos fluxos reais.
    const base = this.db.select().from(animals).$dynamic();
    const rows = await (where ? base.where(where) : base).orderBy(asc(animals.createdAt), asc(animals.id));
    const photosByAnimal = await this.loadPhotos(rows.map((r) => r.id));
    return rows.map((row) => rowToAnimal(row, photosByAnimal.get(row.id) ?? []));
  }

  private async persistAnimal(animal: Animal): Promise<void> {
    const row = animalToRow(animal);
    const { id: _ignored, ...updatable } = row;
    await this.db.insert(animals).values(row).onConflictDoUpdate({ target: animals.id, set: updatable });
    await this.db.delete(animalPhotos).where(eq(animalPhotos.animalId, animal.id));
    const photoRows = animal.photos.map((photo, index) => photoToRow(photo, index));
    if (photoRows.length > 0) {
      await this.db.insert(animalPhotos).values(photoRows);
    }
  }

  async saveLocal(animal: Animal): Promise<void> {
    await this.persistAnimal(animal);
  }

  async upsertCache(cached: Animal[]): Promise<void> {
    for (const animal of cached) {
      await this.persistAnimal(animal);
    }
  }

  async listByOwner(ownerId: string): Promise<Animal[]> {
    return this.search({ ownerId });
  }

  async createRemote(_animal: Animal): Promise<Animal> {
    throw new Error(REMOTE_UNAVAILABLE);
  }

  async updateRemote(_animal: Animal): Promise<Animal> {
    throw new Error(REMOTE_UNAVAILABLE);
  }

  async deleteRemote(_id: string): Promise<void> {
    throw new Error(REMOTE_UNAVAILABLE);
  }
}
