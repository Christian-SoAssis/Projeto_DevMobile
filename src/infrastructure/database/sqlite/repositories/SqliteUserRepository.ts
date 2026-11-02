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
  bio: string | null;
  avatar_uri: string | null;
  interests: string | null;
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
      `INSERT INTO users (id, name, email, phone, user_type, bio, avatar_uri, interests, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         email = excluded.email,
         phone = excluded.phone,
         user_type = excluded.user_type,
         bio = excluded.bio,
         avatar_uri = excluded.avatar_uri,
         interests = excluded.interests`,
      [
        user.id,
        user.name,
        user.contactInfo.email,
        user.contactInfo.phone || null,
        user.role,
        user.bio || null,
        user.avatarUri || null,
        JSON.stringify(user.interests),
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
      bio: row.bio || undefined,
      avatarUri: row.avatar_uri || undefined,
      interests: parseInterests(row.interests),
    });
  }
}

function parseInterests(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
