/** Manifestação de interesse como o servidor a guarda (tabela `adoption_interests`). */
export interface RemoteInterest {
  id: string;
  userId: string;
  animalId: string;
  message?: string;
  /** Contato do interessado, visível ao responsável pelo anúncio (doc §15.1). */
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  createdAt?: string;
}

/**
 * Perna remota dos interesses. O interessado grava; o responsável pelo
 * anúncio lê os recebidos — a RLS garante os dois lados (§15.1/§15.3).
 */
export interface InterestRemoteGateway {
  /** Idempotente: o mesmo usuário já ter demonstrado interesse não é erro. */
  createRemote(interest: RemoteInterest): Promise<void>;
  /** Interesses recebidos num anúncio (só o dono do anúncio enxerga). */
  listForAnimal(animalId: string): Promise<RemoteInterest[]>;
}
