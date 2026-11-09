/**
 * Etapa da trilha como o servidor guarda (decisão 18). Tokens ASCII; o valor
 * legado `PENDING` do servidor é tratado como ENVIADA na leitura.
 */
export interface RemoteInterest {
  id: string;
  userId: string;
  animalId: string;
  message?: string;
  /** Contato do interessado, visível ao responsável pelo anúncio (doc §15.1). */
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  /** Trilha: ENVIADA/EM_ANALISE/VISITA_COMBINADA/CONCLUIDA/RECUSADA (legado PENDING). */
  status?: string;
  /** Quando a etapa mudou por último (alimenta o feed de notificações). */
  updatedAt?: string;
  createdAt?: string;
}

/**
 * Perna remota dos interesses. O interessado grava; o responsável pelo
 * anúncio lê os recebidos; o interessado lê AS PRÓPRIAS (trilha viva).
 * A RLS garante os três lados (§15.1/§15.3).
 */
export interface InterestRemoteGateway {
  /** Idempotente: o mesmo usuário já ter demonstrado interesse não é erro. */
  createRemote(interest: RemoteInterest): Promise<void>;
  /** Interesses recebidos num anúncio (só o dono do anúncio enxerga). */
  listForAnimal(animalId: string): Promise<RemoteInterest[]>;
  /** Trilha (decisão 18): as manifestações PRÓPRIAS do usuário. */
  listForUser(userId: string): Promise<RemoteInterest[]>;
  /** Responsável avança/recusa a etapa da manifestação. */
  updateStatusRemote(interestId: string, status: string, updatedAt?: string): Promise<void>;
}
