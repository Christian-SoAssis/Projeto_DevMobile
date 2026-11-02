import { AuthGateway, AuthSession, RegisterInput, RegisterResult } from '../../domain/ports/AuthGateway';
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

  async register(input: RegisterInput): Promise<RegisterResult> {
    const email = input.email.trim();
    if (this.mockUsers.some((u) => u.contactInfo.email.toLowerCase() === email.toLowerCase())) {
      throw new Error('E-mail já cadastrado (mock).');
    }
    const user = new User({
      id: `usr_${Date.now()}`,
      name: input.name.trim(),
      contactInfo: new ContactInfo(email, input.phone?.trim() || '11900000000'),
      role: 'USER',
    });
    this.mockUsers.push(user);
    return { user, needsEmailConfirmation: false };
  }

  async updateProfile(user: User): Promise<User> {
    const idx = this.mockUsers.findIndex((u) => u.id === user.id);
    if (idx >= 0) this.mockUsers[idx] = user;
    if (this.currentSession?.user.id === user.id) {
      this.currentSession = { ...this.currentSession, user };
    }
    return user;
  }

  async login(email: string, pass: string): Promise<AuthSession> {
    if (pass === 'wrong_password') {
      throw new Error('Credenciais inválidas.');
    }
    const user = this.mockUsers.find((u) => u.contactInfo.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      throw new Error('Usuário não encontrado.');
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
    const user = this.mockUsers[0];
    this.currentSession = { user, token };
    return this.currentSession;
  }
}
