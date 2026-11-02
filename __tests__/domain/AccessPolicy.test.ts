import { canAccess, isAuthenticatedRole, requiredAccessLevel, AppArea } from '../../src/domain/services/AccessPolicy';
import {
  validateLogin,
  validateRegistration,
  isValidEmail,
  MIN_PASSWORD_LENGTH,
} from '../../src/domain/services/CredentialPolicy';

describe('AccessPolicy (doc §1.1 / §15.1)', () => {
  const publicAreas: AppArea[] = ['SEARCH', 'ANIMAL_DETAILS'];
  const authAreas: AppArea[] = ['FAVORITES', 'EXPRESS_INTEREST', 'MY_ANIMALS', 'MANAGE_ANIMAL', 'SYNC'];

  it('visitante (null/undefined/VISITOR) só acessa áreas públicas', () => {
    for (const role of [null, undefined, 'VISITOR' as const]) {
      publicAreas.forEach((a) => expect(canAccess(role, a)).toBe(true));
      [...authAreas, 'MODERATION' as const].forEach((a) => expect(canAccess(role, a)).toBe(false));
    }
  });

  it('qualquer usuário autenticado acessa áreas autenticadas, mas não a moderação', () => {
    for (const role of ['USER', 'RESPONSIBLE', 'INTERESTED'] as const) {
      [...publicAreas, ...authAreas].forEach((a) => expect(canAccess(role, a)).toBe(true));
      expect(canAccess(role, 'MODERATION')).toBe(false);
    }
  });

  it('administrador acessa tudo', () => {
    [...publicAreas, ...authAreas, 'MODERATION' as const].forEach((a) =>
      expect(canAccess('ADMIN', a)).toBe(true)
    );
  });

  it('expõe nível exigido e papel autenticado', () => {
    expect(requiredAccessLevel('SEARCH')).toBe('PUBLIC');
    expect(requiredAccessLevel('FAVORITES')).toBe('AUTHENTICATED');
    expect(requiredAccessLevel('MODERATION')).toBe('ADMIN');
    expect(isAuthenticatedRole('USER')).toBe(true);
    expect(isAuthenticatedRole('VISITOR')).toBe(false);
    expect(isAuthenticatedRole(null)).toBe(false);
  });
});

describe('CredentialPolicy', () => {
  it('valida e-mail', () => {
    expect(isValidEmail(' a@b.co ')).toBe(true);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('sem arroba')).toBe(false);
  });

  it('login: exige campos e e-mail válido, sem tamanho mínimo de senha', () => {
    expect(validateLogin('', '')).toBe('E-mail e senha são obrigatórios.');
    expect(validateLogin('x', '1')).toBe('Informe um e-mail válido.');
    expect(validateLogin('a@b.co', '1')).toBeNull();
  });

  it('cadastro: devolve a primeira violação', () => {
    const ok = { name: 'Ana', email: 'a@b.co', password: '123456', confirmPassword: '123456' };
    expect(validateRegistration(ok)).toBeNull();
    expect(validateRegistration({ ...ok, name: ' ' })).toBe('Nome é obrigatório.');
    expect(validateRegistration({ ...ok, email: '' })).toBe('E-mail é obrigatório.');
    expect(validateRegistration({ ...ok, email: 'x' })).toBe('Informe um e-mail válido.');
    expect(validateRegistration({ ...ok, password: '', confirmPassword: '' })).toBe('Senha é obrigatória.');
    expect(validateRegistration({ ...ok, password: '123', confirmPassword: '123' })).toBe(
      `A senha deve ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`
    );
    expect(validateRegistration({ ...ok, confirmPassword: 'outra1' })).toBe('As senhas não coincidem.');
  });
});
