/**
 * Regras de credenciais (RF07). O mínimo de 6 caracteres espelha o padrão do
 * Supabase Auth; o servidor continua autoritativo — isto só dá feedback cedo.
 */
export const MIN_PASSWORD_LENGTH = 6;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

/** Login: não impõe tamanho de senha (contas antigas), só presença e formato do e-mail. */
export function validateLogin(email: string, password: string): string | null {
  if (!email.trim() || !password) return 'E-mail e senha são obrigatórios.';
  if (!isValidEmail(email)) return 'Informe um e-mail válido.';
  return null;
}

export interface RegistrationFields {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

/** Cadastro: devolve a primeira violação, ou `null` se tudo estiver válido. */
export function validateRegistration(fields: RegistrationFields): string | null {
  if (!fields.name.trim()) return 'Nome é obrigatório.';
  if (!fields.email.trim()) return 'E-mail é obrigatório.';
  if (!isValidEmail(fields.email)) return 'Informe um e-mail válido.';
  if (!fields.password) return 'Senha é obrigatória.';
  if (fields.password.length < MIN_PASSWORD_LENGTH) {
    return `A senha deve ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (fields.password !== fields.confirmPassword) return 'As senhas não coincidem.';
  return null;
}
