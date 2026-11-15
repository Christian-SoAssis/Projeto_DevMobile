import {
  AdoptionInterest,
  InterestStage,
  normalizeInterestStage,
} from '../../../../domain/entities/AdoptionInterest';
import { AdoptionInterestRepository } from '../../../../domain/ports/AdoptionInterestRepository';
import { SqliteDatabaseDriver } from '../DatabaseDriver';

interface InterestRow {
  id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  animal_id: string;
  message: string;
  contact_info: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export class SqliteAdoptionInterestRepository implements AdoptionInterestRepository {
  constructor(private db: SqliteDatabaseDriver) {}

  async save(interest: AdoptionInterest): Promise<void> {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO adoption_interests (
        id, user_id, user_name, user_email, animal_id, message, contact_info, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        interest.id,
        interest.userId,
        interest.userName ?? null,
        interest.userEmail ?? null,
        interest.animalId,
        interest.message,
        interest.contactInfo,
        interest.status,
        interest.createdAt,
        interest.updatedAt,
      ]
    );
  }

  async findById(id: string): Promise<AdoptionInterest | null> {
    const row = await this.db.getFirstAsync<InterestRow>(
      'SELECT * FROM adoption_interests WHERE id = ?',
      [id]
    );
    return row ? this.mapRow(row) : null;
  }

  async listByUser(userId: string): Promise<AdoptionInterest[]> {
    const rows = await this.db.getAllAsync<InterestRow>(
      'SELECT * FROM adoption_interests WHERE user_id = ?',
      [userId]
    );
    return rows.map((r) => this.mapRow(r));
  }

  async listByAnimal(animalId: string): Promise<AdoptionInterest[]> {
    const rows = await this.db.getAllAsync<InterestRow>(
      'SELECT * FROM adoption_interests WHERE animal_id = ?',
      [animalId]
    );
    return rows.map((r) => this.mapRow(r));
  }

  async updateStatus(id: string, status: InterestStage): Promise<void> {
    await this.db.runAsync(
      'UPDATE adoption_interests SET status = ?, updated_at = ? WHERE id = ?',
      [status, new Date().toISOString(), id]
    );
  }

  private mapRow(row: InterestRow): AdoptionInterest {
    return new AdoptionInterest({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name ?? undefined,
      userEmail: row.user_email ?? undefined,
      animalId: row.animal_id,
      message: row.message,
      contactInfo: row.contact_info,
      status: normalizeInterestStage(row.status),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
