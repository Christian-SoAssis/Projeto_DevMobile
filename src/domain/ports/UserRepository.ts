import { User } from '../entities/User';

export interface UserRepository {
  getCurrentUser(): Promise<User | null>;
  saveCurrentUser(user: User): Promise<void>;
  clearCurrentUser(): Promise<void>;
}
