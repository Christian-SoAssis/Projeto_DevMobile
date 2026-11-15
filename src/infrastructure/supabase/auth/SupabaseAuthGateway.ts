import { User, UserRole } from '../../../domain/entities/User';
import {
  AuthGateway,
  AuthSession,
  RegisterInput,
  UpdateProfileInput,
} from '../../../domain/ports/AuthGateway';
import { SupabaseClientLike } from '../types';

interface RemoteUserProfileRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  bio: string | null;
  interests: string[] | null;
  avatar_url: string | null;
  user_type: string | null;
}

/**
 * Gateway de Autenticação e Perfil sobre Supabase Auth + tabela `public.users` (DAT-03).
 */
export class SupabaseAuthGateway implements AuthGateway {
  constructor(private client: SupabaseClientLike) {}

  async login(email: string, password: string): Promise<AuthSession> {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await this.client.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error || !data?.user || !data?.session) {
      throw new Error(error?.message || 'E-mail ou senha inválidos.');
    }

    const user = await this.ensureUserProfile(data.user, {
      name: data.user.user_metadata?.name || cleanEmail.split('@')[0],
      email: cleanEmail,
      contactInfo: data.user.user_metadata?.phone || '',
    });

    return {
      user,
      accessToken: data.session.access_token,
    };
  }

  async register(input: RegisterInput): Promise<AuthSession> {
    const cleanEmail = input.email.trim().toLowerCase();
    const cleanName = input.name.trim();
    const cleanPhone = (input.contactInfo ?? '').trim();

    if (!cleanName) throw new Error('Informe seu nome.');
    if (!cleanEmail) throw new Error('Informe um e-mail válido.');
    if (!input.password || input.password.length < 6) {
      throw new Error('A senha deve ter pelo menos 6 caracteres.');
    }

    const { data, error } = await this.client.auth.signUp({
      email: cleanEmail,
      password: input.password,
      options: {
        data: {
          name: cleanName,
          phone: cleanPhone,
        },
      },
    });

    if (error || !data?.user) {
      throw new Error(error?.message || 'Não foi possível criar a conta.');
    }

    let session = data.session;
    if (!session) {
      const signInRes = await this.client.auth.signInWithPassword({
        email: cleanEmail,
        password: input.password,
      });
      if (signInRes.error || !signInRes.data?.session) {
        throw new Error(
          signInRes.error?.message ||
            'Conta criada! Verifique se a confirmação de e-mail está desativada no Supabase.'
        );
      }
      session = signInRes.data.session;
    }

    const user = await this.ensureUserProfile(data.user, {
      name: cleanName,
      email: cleanEmail,
      contactInfo: cleanPhone,
    });

    return {
      user,
      accessToken: session.access_token,
    };
  }

  async restoreSession(): Promise<AuthSession | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error || !data?.session?.user) {
      return null;
    }

    const authUser = data.session.user;
    const user = await this.ensureUserProfile(authUser, {
      name: authUser.user_metadata?.name || (authUser.email ?? 'Usuário').split('@')[0],
      email: authUser.email ?? 'usuario@exemplo.com',
      contactInfo: authUser.user_metadata?.phone || '',
    });

    return {
      user,
      accessToken: data.session.access_token,
    };
  }

  async updateProfile(input: UpdateProfileInput): Promise<User> {
    const payload = {
      id: input.userId,
      name: input.name.trim(),
      phone: input.contactInfo.trim(),
      bio: input.bio.trim(),
      avatar_url: input.avatarUrl ?? null,
      interests: input.interestsTags ?? ['Cães', 'Gatos'],
    };

    const { data: existing } = await this.client
      .from('users')
      .select('*')
      .eq('id', input.userId)
      .maybeSingle();

    const email = existing?.email || 'usuario@exemplo.com';
    const userType = (existing?.user_type as UserRole) || 'USER';

    const { error } = await this.client.from('users').upsert(
      {
        ...payload,
        email,
        user_type: userType,
      },
      { onConflict: 'id' }
    );

    if (error) {
      throw new Error(`Falha ao salvar perfil: ${error.message}`);
    }

    return new User({
      id: input.userId,
      name: payload.name,
      email,
      contactInfo: payload.phone,
      bio: payload.bio,
      avatarUrl: payload.avatar_url ?? undefined,
      interestsTags: payload.interests,
      role: userType,
    });
  }

  async logout(): Promise<void> {
    await this.client.auth.signOut();
  }

  private async ensureUserProfile(
    authUser: any,
    defaults: { name: string; email: string; contactInfo: string }
  ): Promise<User> {
    const userId = String(authUser.id);
    const { data: existing } = await this.client
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (existing) {
      const row = existing as RemoteUserProfileRow;
      return new User({
        id: row.id,
        name: row.name || defaults.name,
        email: row.email || defaults.email,
        contactInfo: row.phone || defaults.contactInfo,
        bio: row.bio || '',
        avatarUrl: row.avatar_url ?? undefined,
        interestsTags: Array.isArray(row.interests) && row.interests.length > 0 ? row.interests : ['Cães', 'Gatos'],
        role: row.user_type === 'ADMIN' ? 'ADMIN' : 'USER',
      });
    }

    const insertRow = {
      id: userId,
      name: defaults.name,
      email: defaults.email,
      phone: defaults.contactInfo,
      user_type: 'USER',
      bio: '',
      interests: ['Cães', 'Gatos'],
    };

    await this.client.from('users').upsert(insertRow, { onConflict: 'id' });

    return new User({
      id: userId,
      name: defaults.name,
      email: defaults.email,
      contactInfo: defaults.contactInfo,
      bio: '',
      interestsTags: ['Cães', 'Gatos'],
      role: 'USER',
    });
  }
}
