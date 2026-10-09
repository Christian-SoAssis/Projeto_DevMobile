import { AdoptionInterest } from '../../../../domain/entities/AdoptionInterest';
import { AdoptionInterestRepository } from '../../../../domain/ports/AdoptionInterestRepository';
import { SqliteDatabaseDriver } from '../DatabaseDriver';

interface InterestRow {
  id: string;
  user_id: string;
  animal_id: string;
  created_at: string;
}

export class SqliteAdoptionInterestRepository implements AdoptionInterestRepository {
  constructor(private db: SqliteDatabaseDriver) {}

  async registerInterest(interest: AdoptionInterest): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO adoption_interests (id, user_id, animal_id, created_at) VALUES (?, ?, ?, ?)`,
      [interest.id, interest.userId, interest.animalId, interest.createdAt]
    );
  }

  async listByUser(userId: string): Promise<AdoptionInterest[]> {
    const rows = await this.db.getAllAsync<InterestRow>(
      `SELECT * FROM adoption_interests WHERE user_id = ?`,
      [userId]
    );

    return rows.map((r) => new AdoptionInterest(r.id, r.user_id, r.animal_id, r.created_at));
  }

  async listByAnimal(animalId: string): Promise<AdoptionInterest[]> {
    const rows = await this.db.getAllAsync<InterestRow>(
      `SELECT * FROM adoption_interests WHERE animal_id = ?`,
      [animalId]
    );

    return rows.map((r) => new AdoptionInterest(r.id, r.user_id, r.animal_id, r.created_at));
  }

  async hasInterest(userId: string, animalId: string): Promise<boolean> {
    const row = await this.db.getFirstAsync<InterestRow>(
      `SELECT * FROM adoption_interests WHERE user_id = ? AND animal_id = ?`,
      [userId, animalId]
    );
    return !!row;
  }
}
