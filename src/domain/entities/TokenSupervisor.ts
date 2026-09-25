export class TokenSupervisor {
  readonly token: string;
  readonly supervisorId: string;
  readonly expiresAt: Date;
  private _isRevoked: boolean;

  constructor(token: string, supervisorId: string, expiresAt: Date, isRevoked: boolean = false) {
    if (!token) throw new Error('Token é obrigatório.');
    if (!supervisorId) throw new Error('ID do supervisor é obrigatório.');

    this.token = token;
    this.supervisorId = supervisorId;
    this.expiresAt = expiresAt;
    this._isRevoked = isRevoked;
  }

  isValid(): boolean {
    if (this._isRevoked) return false;
    return new Date() < this.expiresAt;
  }

  revogar(): void {
    this._isRevoked = true;
  }
}
