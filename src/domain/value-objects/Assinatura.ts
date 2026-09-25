export class Assinatura {
  readonly base64: string;
  readonly timestamp: string;
  readonly responsavelId: string;

  constructor(base64: string, responsavelId: string, timestamp?: string) {
    if (!base64 || base64.trim().length === 0) {
      throw new Error('Dados da assinatura base64 são obrigatórios.');
    }
    if (!responsavelId || responsavelId.trim().length === 0) {
      throw new Error('ID do responsável pela assinatura é obrigatório.');
    }
    this.base64 = base64.trim();
    this.responsavelId = responsavelId.trim();
    this.timestamp = timestamp || new Date().toISOString();
  }

  isValid(): boolean {
    return this.base64.length > 10;
  }
}
