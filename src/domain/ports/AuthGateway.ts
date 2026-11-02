import { User } from '../entities/User';

export interface AuthSession {
  user: User;
  token: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
}

export interface RegisterResult {
  user: User;
  /** `true` quando o backend exige confirmar o e-mail antes do primeiro login. */
  needsEmailConfirmation: boolean;
}

export interface AuthGateway {
  register(input: RegisterInput): Promise<RegisterResult>;
  /**
   * Grava no servidor o perfil editável (nome, telefone, descrição e
   * interesses). A foto de perfil fica só no aparelho até o Storage (Passo 4).
   */
  updateProfile(user: User): Promise<User>;
  login(email: string, pass: string): Promise<AuthSession>;
  logout(): Promise<void>;
  getCurrentSession(): Promise<AuthSession | null>;
  acessarViaToken(token: string): Promise<AuthSession>;
}
