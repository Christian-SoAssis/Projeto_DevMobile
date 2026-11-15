import { User, UserRole } from '../../../../domain/entities/User';
import { UserRepository } from '../../../../domain/ports/UserRepository';
import { SqliteDatabaseDriver } from '../DatabaseDriver';

interface UserRow {
  id: string;
  name: string;
  email: string;
  contact_info: string;
  bio: string;
  avatar_url: string | null;
  interests_json: string;
  role: string;
}

export class SqliteUserRepository implements UserRepository {
  constructor(private db: SqliteDatabaseDriver) {}

  async getCurrentUser(): Promise<User | null> {
    const rows = await this.db.getAllAsync<UserRow>('SELECT * FROM users');
    const row = rows[0];
    if (!row) return null;

    let interestsTags: string[] = ['Cães', 'Gatos'];
    try {
      const parsed = JSON.parse(row.interests_json || '[]');
      if (Array.isArray(parsed)) interestsTags = parsed;
    } catch {
      // ignora
    }

    return new User({
      id: row.id,
      name: row.name,
      email: row.email,
      contactInfo: row.contact_info,
      bio: row.bio,
      avatarUrl: row.avatar_url ?? undefined,
      interestsTags,
      role: (row.role as UserRole) || 'USER',
    });
  }

  async saveCurrentUser(user: User): Promise<void> {
    await this.db.runAsync('DELETE FROM users');
    await this.db.runAsync(
      `INSERT OR REPLACE INTO users (
        id, name, email, contact_info, bio, avatar_url, interests_json, role
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.name,
        user.email,
        user.contactInfo,
        user.bio,
        user.avatarUrl ?? null,
        JSON.stringify(user.interestsTags ?? []),
        user.role,
      ]
    );
  }

  async clearCurrentUser(): Promise<void> {
    await this.db.runAsync('DELETE FROM users');
  }
}
