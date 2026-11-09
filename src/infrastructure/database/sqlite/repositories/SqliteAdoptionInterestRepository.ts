import { AdoptionInterest } from '../../../../domain/entities/AdoptionInterest';
import { InterestStatus } from '../../../../domain/value-objects/InterestStatus';
import { AdoptionInterestRepository } from '../../../../domain/ports/AdoptionInterestRepository';
import { SqliteDatabaseDriver } from '../DatabaseDriver';

interface InterestRow {
  id: string;
  user_id: string;
  animal_id: string;
  created_at: string;
  /** Trilha (decisão 18). Legado: 'PENDING' → ENVIADA na leitura. */
  status?: string;
  updated_at?: string;
}

export class SqliteAdoptionInterestRepository implements AdoptionInterestRepository {
  constructor(private db: SqliteDatabaseDriver) {}

  async registerInterest(interest: AdoptionInterest): Promise<void> {
    await this.db.runAsync(
      // Trilha: status começa na etapa informada (novo registro = ENVIADA).
      `INSERT INTO adoption_interests (id, user_id, animal_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT DO NOTHING`,
      [
        interest.id,
        interest.userId,
        interest.animalId,
        interest.status.value,
        interest.createdAt,
        interest.updatedAt ?? interest.createdAt,
      ]
    );
  }

  async listByUser(userId: string): Promise<AdoptionInterest[]> {
    const rows = await this.db.getAllAsync<InterestRow>(
      `SELECT * FROM adoption_interests WHERE user_id = ?`,
      [userId]
    );
    return rows.map((r) => new AdoptionInterest(
      r.id,
      r.user_id,
      r.animal_id,
      r.created_at,
      InterestStatus.from(r.status),
      r.updated_at ?? r.created_at
    ));
  }

  async listByAnimal(animalId: string): Promise<AdoptionInterest[]> {
    const rows = await this.db.getAllAsync<InterestRow>(
      `SELECT * FROM adoption_interests WHERE animal_id = ?`,
      [animalId]
    );
    return rows.map((r) => new AdoptionInterest(
      r.id,
      r.user_id,
      r.animal_id,
      r.created_at,
      InterestStatus.from(r.status),
      r.updated_at ?? r.created_at
    ));
  }

  async hasInterest(userId: string, animalId: string): Promise<boolean> {
    const row = await this.db.getFirstAsync<QueryRow>(
      `SELECT id FROM adoption_interests WHERE user_id = ? AND animal_id = ?`,
      [userId, animalId]
    );
    return !!row;
  }

  // Trilha (decisão 18): o responsável avança/recusa. Linha inexistente
  // localmente (row só no servidor) → no-op: a intenção viaja na fila UPDATE.
  async updateStatus(interestId: string, status: InterestStatus, updatedAt: string): Promise<void> {
    await this.db.runAsync(
      `UPDATE adoption_interests SET status = ?, updated_at = ? WHERE id = ?`,
      [status.value, updatedAt, interestId]
    );
  }
}

interface QueryRow {
  id: string;
}
