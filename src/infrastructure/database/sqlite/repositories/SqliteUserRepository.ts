import { User, UserRole } from '../../../../domain/entities/User';
import { UserRepository } from '../../../../domain/ports/UserRepository';
import { ContactInfo } from '../../../../domain/value-objects/ContactInfo';
import { SqliteDatabaseDriver } from '../DatabaseDriver';

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  user_type: string;
  created_at: string;
}

export class SqliteUserRepository implements UserRepository {
  constructor(private db: SqliteDatabaseDriver) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.db.getFirstAsync<UserRow>(
      `SELECT * FROM users WHERE id = ?`,
      [id]
    );
    if (!row) return null;
    return this.mapToEntity(row);
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db.getFirstAsync<UserRow>(
      `SELECT * FROM users WHERE email = ?`,
      [email.toLowerCase().trim()]
    );
    if (!row) return null;
    return this.mapToEntity(row);
  }

  async save(user: User): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO users (id, name, email, phone, user_type, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.name,
        user.contactInfo.email,
        user.contactInfo.phone || null,
        user.role,
        new Date().toISOString(),
      ]
    );
  }

  private mapToEntity(row: UserRow): User {
    return new User({
      id: row.id,
      name: row.name,
      contactInfo: new ContactInfo(row.email, row.phone || undefined),
      role: row.user_type as UserRole,
    });
  }
}
