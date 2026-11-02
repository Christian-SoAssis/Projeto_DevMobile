import { UserRole } from '../entities/User';

/**
 * Áreas do app para fins de controle de acesso (doc §1.1 atores, §15.1 RLS).
 *
 * - PÚBLICAS (visitante): consultar, pesquisar e ver detalhes (RF01–RF06).
 * - AUTENTICADAS: favoritar, demonstrar interesse, criar/gerir anúncios
 *   (RF08, RF14, RF16) e sincronizar as próprias pendências.
 * - ADMIN: moderação (RF27). Qualquer usuário autenticado pode ser
 *   interessado e responsável; "Responsável/Interessado" são
 *   especializações, não barreiras de acesso.
 */
export type AppArea =
  | 'SEARCH'
  | 'ANIMAL_DETAILS'
  | 'FAVORITES'
  | 'EXPRESS_INTEREST'
  | 'MY_ANIMALS'
  | 'MANAGE_ANIMAL'
  | 'SYNC'
  | 'MODERATION';

export type AccessLevel = 'PUBLIC' | 'AUTHENTICATED' | 'ADMIN';

const REQUIRED_LEVEL: Record<AppArea, AccessLevel> = {
  SEARCH: 'PUBLIC',
  ANIMAL_DETAILS: 'PUBLIC',
  FAVORITES: 'AUTHENTICATED',
  EXPRESS_INTEREST: 'AUTHENTICATED',
  MY_ANIMALS: 'AUTHENTICATED',
  MANAGE_ANIMAL: 'AUTHENTICATED',
  SYNC: 'AUTHENTICATED',
  MODERATION: 'ADMIN',
};

export function requiredAccessLevel(area: AppArea): AccessLevel {
  return REQUIRED_LEVEL[area];
}

/** `null`/`undefined`/`VISITOR` = não autenticado. */
export function isAuthenticatedRole(role: UserRole | null | undefined): boolean {
  return !!role && role !== 'VISITOR';
}

export function canAccess(role: UserRole | null | undefined, area: AppArea): boolean {
  switch (REQUIRED_LEVEL[area]) {
    case 'PUBLIC':
      return true;
    case 'AUTHENTICATED':
      return isAuthenticatedRole(role);
    case 'ADMIN':
      return role === 'ADMIN';
  }
}

export const ROLE_LABELS: Record<UserRole, string> = {
  VISITOR: 'Visitante',
  USER: 'Usuário',
  RESPONSIBLE: 'Responsável',
  INTERESTED: 'Interessado',
  ADMIN: 'Administrador',
};
