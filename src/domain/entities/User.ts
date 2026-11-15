export type UserRole = 'USER' | 'ADMIN';

export interface UserProps {
  id: string;
  name: string;
  email: string;
  contactInfo?: string;
  bio?: string;
  avatarUrl?: string;
  interestsTags?: string[];
  role?: UserRole;
}

export class User {
  public readonly id: string;
  public readonly name: string;
  public readonly email: string;
  public readonly contactInfo: string;
  public readonly bio: string;
  public readonly avatarUrl?: string;
  public readonly interestsTags: string[];
  public readonly role: UserRole;

  constructor(props: UserProps) {
    if (!props.id || !props.id.trim()) {
      throw new Error('O ID do usuário é obrigatório.');
    }
    if (!props.email || !props.email.trim()) {
      throw new Error('O e-mail do usuário é obrigatório.');
    }
    this.id = props.id.trim();
    this.name = (props.name || props.email.split('@')[0]).trim();
    this.email = props.email.trim().toLowerCase();
    this.contactInfo = (props.contactInfo ?? '').trim();
    this.bio = (props.bio ?? '').trim();
    this.avatarUrl = props.avatarUrl;
    this.interestsTags = props.interestsTags ?? ['Cães', 'Gatos'];
    this.role = props.role ?? 'USER';
  }

  isAdmin(): boolean {
    return this.role === 'ADMIN';
  }
}
