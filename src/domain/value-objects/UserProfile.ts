/**
 * Perfil editável do usuário (tela Conta).
 *
 * Os limites abaixo são PROVISÓRIOS: o doc §19 deixa "campos e limites de
 * formulário" como decisão de produto em aberto. Mudar aqui exige mudar
 * também o `check` de `public.users.bio` em `supabase/init.sql`.
 */
export const MAX_BIO_LENGTH = 300;

/** Interesses de adoção selecionáveis (espécie, idade e porte do animal). */
export const PROFILE_INTERESTS = [
  'Cães',
  'Gatos',
  'Filhotes',
  'Adultos',
  'Idosos',
  'Porte pequeno',
  'Porte médio',
  'Porte grande',
] as const;

export type ProfileInterest = (typeof PROFILE_INTERESTS)[number];

/** Mantém só interesses conhecidos, sem repetição e na ordem canônica. */
export function normalizeInterests(raw: readonly string[] | undefined | null): string[] {
  const wanted = new Set((raw ?? []).map((i) => String(i).trim()));
  return PROFILE_INTERESTS.filter((i) => wanted.has(i));
}

/** Campos que a pessoa pode alterar no próprio perfil. */
export interface ProfilePatch {
  name?: string;
  phone?: string;
  bio?: string;
  interests?: readonly string[];
  /** `null` remove a foto; `undefined` mantém. */
  avatarUri?: string | null;
  /** URL pública da foto no Storage (`null` remove; `undefined` mantém). */
  avatarUrl?: string | null;
}
