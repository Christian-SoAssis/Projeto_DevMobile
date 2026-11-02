import { ContactInfo } from '../value-objects/ContactInfo';
import { MAX_BIO_LENGTH, ProfilePatch, normalizeInterests } from '../value-objects/UserProfile';

export type UserRole = 'VISITOR' | 'USER' | 'RESPONSIBLE' | 'INTERESTED' | 'ADMIN';

export interface UserProps {
  id: string;
  name: string;
  contactInfo: ContactInfo;
  role?: UserRole;
  bio?: string;
  avatarUri?: string;
  /** Foto de perfil no Storage (visível em qualquer aparelho); `avatarUri` é a cópia local. */
  avatarUrl?: string;
  interests?: readonly string[];
}

export class User {
  readonly id: string;
  readonly name: string;
  readonly contactInfo: ContactInfo;
  readonly role: UserRole;
  readonly bio: string;
  readonly avatarUri?: string;
  readonly avatarUrl?: string;
  readonly interests: string[];

  constructor(props: UserProps) {
    if (!props.id) throw new Error('ID do usuário é obrigatório.');
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Nome do usuário é obrigatório.');
    }
    const bio = (props.bio ?? '').trim();
    if (bio.length > MAX_BIO_LENGTH) {
      throw new Error(`A descrição deve ter no máximo ${MAX_BIO_LENGTH} caracteres.`);
    }

    this.id = props.id;
    this.name = props.name.trim();
    this.contactInfo = props.contactInfo;
    this.role = props.role || 'USER';
    this.bio = bio;
    this.avatarUri = props.avatarUri || undefined;
    this.avatarUrl = props.avatarUrl || undefined;
    this.interests = normalizeInterests(props.interests);
  }

  isAdmin(): boolean {
    return this.role === 'ADMIN';
  }

  /**
   * Novo `User` com o perfil alterado. Identidade (id, e-mail, papel) nunca
   * muda por aqui — o papel só muda no servidor (§15.3).
   */
  withProfile(patch: ProfilePatch): User {
    const phone = patch.phone === undefined ? this.contactInfo.phone : patch.phone.trim() || undefined;
    return new User({
      id: this.id,
      name: patch.name === undefined ? this.name : patch.name,
      contactInfo: new ContactInfo(this.contactInfo.email, phone),
      role: this.role,
      bio: patch.bio === undefined ? this.bio : patch.bio,
      avatarUri: patch.avatarUri === undefined ? this.avatarUri : patch.avatarUri || undefined,
      avatarUrl: patch.avatarUrl === undefined ? this.avatarUrl : patch.avatarUrl || undefined,
      interests: patch.interests === undefined ? this.interests : patch.interests,
    });
  }
}
