import { AuthGateway, AuthSession, RegisterInput, RegisterResult } from '../../../domain/ports/AuthGateway';
import { User } from '../../../domain/entities/User';
import { ContactInfo } from '../../../domain/value-objects/ContactInfo';
import {
  SupabaseClientLike,
  SupabaseAuthUser,
  UserRow,
} from '../types';

export interface SupabaseAuthGatewayOptions {
  client: SupabaseClientLike;
}

/**
 * Gateway de autenticação real (RF07) via Supabase **e-mail/senha** —
 * método decidido por produto (bloqueador §4, registrado no nextsteps §4).
 *
 * Defesa em profundidade (§15.3): o papel ADMIN usado pelo
 * `ModerateAnimalUseCase` vem do `public.users.user_type` — nunca de
 * metadata editável pelo cliente sem a checagem da tabela.
 */
export class SupabaseAuthGateway implements AuthGateway {
  private client: SupabaseClientLike;

  constructor(options: SupabaseAuthGatewayOptions) {
    this.client = options.client;
  }

  /**
   * Garante que o PostgREST/Storage do `@supabase/supabase-js` envie o JWT
   * autenticado mesmo quando a sessão foi restaurada do SecureStore via
   * `acessarViaToken` (onde `auth.getUser(token)` não popula `auth.getSession()`).
   */
  private bindAccessToken(token: string | null): void {
    const target = this.client as SupabaseClientLike & {
      accessToken?: (() => Promise<string | null>) | undefined;
    };
    if (token) {
      target.accessToken = async () => token;
    } else {
      delete target.accessToken;
    }
  }

  async register(input: RegisterInput): Promise<RegisterResult> {
    const email = input.email.trim();
    const name = input.name.trim();
    const phone = input.phone?.trim() || undefined;
    const { data, error } = await this.client.auth.signUp({
      email,
      password: input.password,
      // `user_type` fica de fora de propósito: o papel nasce 'USER' no trigger.
      options: { data: { name, phone } },
    });

    if (error) {
      throw new Error(mapSupabaseAuthError(error.message, 'Não foi possível concluir o cadastro.'));
    }
    if (!data.user) {
      throw new Error('Não foi possível concluir o cadastro.');
    }
    // E-mail já cadastrado: o Supabase devolve um usuário sem identidades em vez de erro.
    const identities = (data.user as { identities?: unknown[] }).identities;
    if (Array.isArray(identities) && identities.length === 0) {
      throw new Error('E-mail já cadastrado.');
    }

    const user = new User({
      id: data.user.id,
      name: name || 'Usuário Enlace',
      contactInfo: new ContactInfo(data.user.email || email, phone),
      role: 'USER',
    });
    return { user, needsEmailConfirmation: !data.session };
  }

  async updateProfile(user: User): Promise<User> {
    let result: { data: UserRow[] | null; error: { message: string } | null };
    try {
      result = (await Promise.resolve(
        this.client
          .from<UserRow>('users')
          .update({
            name: user.name,
            phone: user.contactInfo.phone ?? null,
            bio: user.bio,
            interests: user.interests,
            avatar_url: user.avatarUrl ?? null,
          })
          .eq('id', user.id)
          .select()
      )) as typeof result;
    } catch (err) {
      throw new Error(
        mapSupabaseAuthError(err instanceof Error ? err.message : '', 'Não foi possível salvar o perfil.')
      );
    }
    if (result.error) {
      throw new Error(mapSupabaseAuthError(result.error.message, 'Não foi possível salvar o perfil.'));
    }
    // Zero linhas: RLS barrou ou o perfil não existe — nada foi gravado.
    if (!result.data || result.data.length === 0) {
      throw new Error('Não foi possível salvar o perfil no servidor.');
    }
    return user;
  }

  async login(email: string, pass: string): Promise<AuthSession> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: email.trim(),
      password: pass,
    });

    if (error) {
      throw new Error(
        mapSupabaseAuthError(error.message, 'Não foi possível entrar. Verifique e-mail e senha.')
      );
    }
    if (!data.session) {
      throw new Error('Não foi possível entrar. Verifique e-mail e senha.');
    }
    this.bindAccessToken(data.session.access_token);
    const user = await this.resolveUser(data.session.user);
    return { user, token: data.session.access_token };
  }

  async logout(): Promise<void> {
    this.bindAccessToken(null);
    const { error } = await this.client.auth.signOut();
    if (error) {
      throw new Error(`Falha ao encerrar a sessão: ${error.message}`);
    }
  }

  async getCurrentSession(): Promise<AuthSession | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error || !data.session) {
      return null;
    }
    this.bindAccessToken(data.session.access_token);
    const user = await this.resolveUser(data.session.user);
    return { user, token: data.session.access_token };
  }

  async acessarViaToken(token: string): Promise<AuthSession> {
    const { data, error } = await this.client.auth.getUser(token);
    if (error || !data.user) {
      this.bindAccessToken(null);
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    this.bindAccessToken(token);
    const user = await this.resolveUser(data.user);
    return { user, token };
  }

  /**
   * Monta o `User` de domínio: id/e-mail do auth; nome/telefone/role do
   * metadado com fallback no perfil `public.users` (fonte autoritativa de
   * `user_type` — RLS deixa cada usuário ler o próprio perfil).
   */
  private async resolveUser(authUser: SupabaseAuthUser): Promise<User> {
    const metadata = (authUser.user_metadata || {}) as Record<string, unknown>;
    const email = authUser.email || String(metadata.email || '');
    let name = typeof metadata.name === 'string' ? metadata.name : undefined;
    let phone = typeof metadata.phone === 'string' ? metadata.phone : undefined;
    let role = normalizeRole(metadata.user_type);
    let bio: string | undefined;
    let interests: string[] | undefined;
    let avatarUrl: string | undefined;

    try {
      const { data, error } = (await Promise.resolve(
        this.client.from<UserRow>('users').select('name,email,phone,user_type,bio,interests,avatar_url').eq('id', authUser.id)
      )) as { data: UserRow[] | null; error: { message: string } | null };

      if (!error && data && data.length > 0) {
        const profile = data[0];
        name = profile.name || name;
        phone = profile.phone || phone;
        role = normalizeRole(profile.user_type) || role;
        bio = profile.bio || undefined;
        interests = profile.interests || undefined;
        avatarUrl = profile.avatar_url || undefined;
      }
    } catch {
      // Perfil indisponível: sessão ainda é válida com o papel padrão 'USER'
      // (a RLS continua autoritativa no servidor — nunca confiamos na UI).
    }

    try {
      return new User({
        id: authUser.id,
        name: name || 'Usuário Enlace',
        contactInfo: new ContactInfo(
          email || 'sem-email@enlace.local',
          phone
        ),
        role,
        bio,
        interests,
        avatarUrl,
      });
    } catch {
      // E-mail ausente/inválido: mantém a sessão com um contato neutro (o app
      // não quebra; o perfil real pode ser concluído depois).
      return new User({
        id: authUser.id,
        name: name || 'Usuário Enlace',
        contactInfo: new ContactInfo('sem-email@enlace.local'),
        role,
        bio,
        interests,
        avatarUrl,
      });
    }
  }
}

export function mapSupabaseAuthError(message: string, fallback: string): string {
  const normalized = (message || '').toLowerCase();
  if (normalized.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar.';
  }
  if (normalized.includes('already registered')) {
    return 'E-mail já cadastrado.';
  }
  if (normalized.includes('password should be') || normalized.includes('weak password')) {
    return 'Senha muito fraca: use ao menos 6 caracteres.';
  }
  if (normalized.includes('failed to fetch') || normalized.includes('network')) {
    return 'Sem conexão com o servidor. O app continua funcionando offline.';
  }
  if (normalized.includes('rate limit') || normalized.includes('too many')) {
    return 'Muitas tentativas. Aguarde alguns instantes e tente novamente.';
  }
  return message || fallback;
}

function normalizeRole(raw: unknown): 'VISITOR' | 'USER' | 'RESPONSIBLE' | 'INTERESTED' | 'ADMIN' {
  const value = String(raw || '').toUpperCase();
  return value as 'VISITOR' | 'USER' | 'RESPONSIBLE' | 'INTERESTED' | 'ADMIN';
}
