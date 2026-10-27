import { User } from '../entities/User';

export interface AuthSession {
  user: User;
  token: string;
}

export interface RegisterUserInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
}

export interface AuthGateway {
  register(input: RegisterUserInput): Promise<User>;
  login(email: string, pass: string): Promise<AuthSession>;
  logout(): Promise<void>;
  getCurrentSession(): Promise<AuthSession | null>;
  acessarViaToken(token: string): Promise<AuthSession>;
}
