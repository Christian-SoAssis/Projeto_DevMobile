import { AuthGateway, AuthSession } from '../../domain/ports/AuthGateway';
import { SessionStorage } from '../../domain/ports/SessionStorage';

export class AcessarViaTokenUseCase {
  constructor(
    private authGateway: AuthGateway,
    private sessionStorage: SessionStorage
  ) {}

  async execute(token: string): Promise<AuthSession> {
    if (!token) throw new Error('Token de acesso é obrigatório.');
    const session = await this.authGateway.acessarViaToken(token);
    await this.sessionStorage.saveSessionToken(session.token);
    return session;
  }
}
