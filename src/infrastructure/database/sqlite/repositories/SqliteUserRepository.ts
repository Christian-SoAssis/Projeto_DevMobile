import { eq } from 'drizzle-orm';
import { User } from '../../../../domain/entities/User';
import type { UserRepository } from '../../../../domain/ports/UserRepository';
import type { AppDatabase } from '../connection';
import { profiles } from '../schema';
import { rowToUser, userToRow } from '../mappers';

// Cache local de perfis (doc §4.2: sessão/cache conforme necessidade).
// Identidade canônica continua no Supabase Auth (Fase 3).
export class SqliteUserRepository implements UserRepository {
  constructor(private readonly db: AppDatabase) {}

  async findById(id: string): Promise<User | null> {
    const rows = await this.db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
    if (rows.length === 0) return null;
    const data = rowToUser(rows[0]);
    return new User({ id: data.id, name: data.name, contactInfo: data.contactInfo, role: data.role as User['role'] });
  }

  async findByEmail(email: string): Promise<User | null> {
    const rows = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.email, email.trim().toLowerCase()))
      .limit(1);
    if (rows.length === 0) return null;
    const data = rowToUser(rows[0]);
    return new User({ id: data.id, name: data.name, contactInfo: data.contactInfo, role: data.role as User['role'] });
  }

  async save(user: User): Promise<void> {
    const row = userToRow(user);
    const { id: _ignored, ...updatable } = row;
    await this.db.insert(profiles).values(row).onConflictDoUpdate({ target: profiles.id, set: updatable });
  }
}
