import { AuthGateway, AuthSession } from '../../domain/ports/AuthGateway';
import { SessionStorage } from '../../domain/ports/SessionStorage';

export class AuthenticateUserUseCase {
  constructor(
    private authGateway: AuthGateway,
    private sessionStorage: SessionStorage
  ) {}

  async execute(email: string, pass: string): Promise<AuthSession> {
    if (!email || !pass) {
      throw new Error('E-mail e senha são obrigatórios.');
    }
    const session = await this.authGateway.login(email, pass);
    await this.sessionStorage.saveSessionToken(session.token);
    return session;
  }
}
