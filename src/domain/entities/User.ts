import { ContactInfo } from '../value-objects/ContactInfo';

export type UserRole = 'VISITOR' | 'USER' | 'RESPONSIBLE' | 'INTERESTED' | 'ADMIN';

export interface UserProps {
  id: string;
  name: string;
  contactInfo: ContactInfo;
  role?: UserRole;
}

export class User {
  readonly id: string;
  readonly name: string;
  readonly contactInfo: ContactInfo;
  readonly role: UserRole;

  constructor(props: UserProps) {
    if (!props.id) throw new Error('ID do usuário é obrigatório.');
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Nome do usuário é obrigatório.');
    }

    this.id = props.id;
    this.name = props.name.trim();
    this.contactInfo = props.contactInfo;
    this.role = props.role || 'USER';
  }

  isAdmin(): boolean {
    return this.role === 'ADMIN';
  }
}
