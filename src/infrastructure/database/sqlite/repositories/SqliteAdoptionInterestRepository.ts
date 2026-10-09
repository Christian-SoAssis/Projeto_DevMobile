import { and, asc, eq } from 'drizzle-orm';
import type { AdoptionInterest } from '../../../../domain/entities/AdoptionInterest';
import type { AdoptionInterestRepository } from '../../../../domain/ports/AdoptionInterestRepository';
import type { AppDatabase } from '../connection';
import { adoptionInterests } from '../schema';
import { interestToRow, rowToInterest } from '../mappers';

export class SqliteAdoptionInterestRepository implements AdoptionInterestRepository {
  constructor(private readonly db: AppDatabase) {}

  async registerInterest(interest: AdoptionInterest): Promise<void> {
    await this.db.insert(adoptionInterests).values(interestToRow(interest)).onConflictDoNothing();
  }

  async listByUser(userId: string): Promise<AdoptionInterest[]> {
    const rows = await this.db
      .select()
      .from(adoptionInterests)
      .where(eq(adoptionInterests.userId, userId))
      .orderBy(asc(adoptionInterests.createdAt));
    return rows.map(rowToInterest);
  }

  async listByAnimal(animalId: string): Promise<AdoptionInterest[]> {
    const rows = await this.db
      .select()
      .from(adoptionInterests)
      .where(eq(adoptionInterests.animalId, animalId))
      .orderBy(asc(adoptionInterests.createdAt));
    return rows.map(rowToInterest);
  }

  async hasInterest(userId: string, animalId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: adoptionInterests.id })
      .from(adoptionInterests)
      .where(and(eq(adoptionInterests.userId, userId), eq(adoptionInterests.animalId, animalId)))
      .limit(1);
    return rows.length > 0;
  }
}
