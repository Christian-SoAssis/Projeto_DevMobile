import { AuthGateway, AuthSession, RegisterUserInput } from '../../domain/ports/AuthGateway';
import { User } from '../../domain/entities/User';
import { ContactInfo } from '../../domain/value-objects/ContactInfo';

export class AuthGatewayFake implements AuthGateway {
  public currentSession: AuthSession | null = null;
  public mockUsers: User[] = [
    new User({
      id: 'usr_1',
      name: 'Ana Silva',
      contactInfo: new ContactInfo('ana@exemplo.com', '11999998888'),
      role: 'RESPONSIBLE',
    }),
    new User({
      id: 'usr_2',
      name: 'Carlos Oliveira',
      contactInfo: new ContactInfo('carlos@exemplo.com', '11977776666'),
      role: 'INTERESTED',
    }),
    new User({
      id: 'usr_admin',
      name: 'Admin Sistema',
      contactInfo: new ContactInfo('admin@exemplo.com', '11900000000'),
      role: 'ADMIN',
    }),
  ];
  /** Senhas dos usuários cadastrados via `register`; usuários seed aceitam qualquer senha (demo). */
  private passwords: Map<string, string> = new Map();

  async register(input: RegisterUserInput): Promise<User> {
    const email = input.email.trim();
    if (this.findByEmail(email)) {
      throw new Error('E-mail já cadastrado (mock).');
    }
    const user = new User({
      id: `usr_${Date.now()}`,
      name: input.name,
      contactInfo: new ContactInfo(email, input.phone),
      role: 'USER',
    });
    this.mockUsers.push(user);
    this.passwords.set(user.id, input.password);
    return user;
  }

  async login(email: string, pass: string): Promise<AuthSession> {
    if (pass === 'wrong_password') {
      throw new Error('Credenciais inválidas.');
    }
    const user = this.findByEmail(email);
    if (!user) {
      throw new Error('Usuário não encontrado.');
    }
    const expected = this.passwords.get(user.id);
    if (expected !== undefined && expected !== pass) {
      throw new Error('Credenciais inválidas.');
    }
    this.currentSession = {
      user,
      token: `fake_token_${user.id}`,
    };
    return this.currentSession;
  }

  async logout(): Promise<void> {
    this.currentSession = null;
  }

  async getCurrentSession(): Promise<AuthSession | null> {
    return this.currentSession;
  }

  async acessarViaToken(token: string): Promise<AuthSession> {
    if (token === 'expired_token' || token === 'invalid_token') {
      throw new Error('Token de acesso inválido ou expirado.');
    }
    // Tokens emitidos por `login` têm o formato `fake_token_<userId>`.
    const userId = token.startsWith('fake_token_') ? token.slice('fake_token_'.length) : null;
    const user = (userId && this.mockUsers.find((u) => u.id === userId)) || this.mockUsers[0];
    this.currentSession = { user, token };
    return this.currentSession;
  }

  private findByEmail(email: string): User | undefined {
    return this.mockUsers.find((u) => u.contactInfo.email.toLowerCase() === email.toLowerCase());
  }
}
