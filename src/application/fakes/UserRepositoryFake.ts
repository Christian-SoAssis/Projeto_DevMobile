import { User } from '../../domain/entities/User';
import { UserRepository } from '../../domain/ports/UserRepository';

export class UserRepositoryFake implements UserRepository {
  public users: Map<string, User> = new Map();

  constructor(initialUsers: User[] = []) {
    initialUsers.forEach((u) => this.users.set(u.id, u));
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const found = Array.from(this.users.values()).find(
      (u) => u.contactInfo.email.toLowerCase() === email.toLowerCase()
    );
    return found || null;
  }

  async save(user: User): Promise<void> {
    this.users.set(user.id, user);
  }
}
