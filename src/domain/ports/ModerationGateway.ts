/**
 * Moderação de anúncios (UC20, RF27, doc §15.1 "moderação só admin").
 *
 * Bloqueador §4 em aberto: os **tipos definitivos** de ação (ocultar,
 * remover, suspender…) precisam de decisão de produto. O par mínimo
 * HIDE/UNHIDE entra aqui como implementação provisória registrada no
 * `docs/nextsteps.md` (regra §0.7: nada além foi implementado por suposição).
 */
export type ModerationAction = 'HIDE' | 'UNHIDE';

export interface ModerationGateway {
  /**
   * Aplica a ação no cadastro remoto. A autenticação e o papel ADMIN do
   * usuário são verificados duas vezes: no use case e na RLS do Postgres
   * (`animals` — política de moderação via `is_admin()`; doc §15.3).
   */
  moderateAnimal(animalId: string, action: ModerationAction): Promise<void>;
}
