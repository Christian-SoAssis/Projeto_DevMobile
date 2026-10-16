import { User } from '../entities/User';

export interface AuthSession {
  user: User;
  token: string;
}

export interface AuthGateway {
  login(email: string, pass: string): Promise<AuthSession>;
  logout(): Promise<void>;
  getCurrentSession(): Promise<AuthSession | null>;
  acessarViaToken(token: string): Promise<AuthSession>;
}
