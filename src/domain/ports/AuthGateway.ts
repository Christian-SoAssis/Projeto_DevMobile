import { User } from '../entities/User';
import { TokenSupervisor } from '../entities/TokenSupervisor';

export interface AuthSession {
  user: User;
  token: string;
}

export interface AuthGateway {
  login(email: string, pass: string): Promise<AuthSession>;
  logout(): Promise<void>;
  getCurrentSession(): Promise<AuthSession | null>;
  acessarViaToken(token: string): Promise<AuthSession>;
  validarTokenSupervisor(token: string): Promise<TokenSupervisor | null>;
}
