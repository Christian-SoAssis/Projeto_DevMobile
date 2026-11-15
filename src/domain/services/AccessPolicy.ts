import { User } from '../entities/User';
import { Animal } from '../entities/Animal';

export type AccessArea = 'PUBLIC' | 'AUTHENTICATED' | 'ADMIN';
export type ActorRole = 'VISITOR' | 'USER' | 'RESPONSIBLE' | 'INTERESTED' | 'ADMIN';

/**
 * Regras de acesso e papéis (UI-08, RF10–RF12, RF27, RNF04).
 */
export class AccessPolicy {
  static canAccessArea(user: User | null, area: AccessArea): boolean {
    if (area === 'PUBLIC') return true;
    if (!user) return false;
    if (area === 'ADMIN') return user.isAdmin();
    return true;
  }

  static canManageAnimal(user: User | null, animal: Animal): boolean {
    if (!user) return false;
    return user.id === animal.ownerId;
  }

  static canModerate(user: User | null): boolean {
    return Boolean(user && user.isAdmin());
  }

  static resolveActorRole(user: User | null, animal?: Animal): ActorRole {
    if (!user) return 'VISITOR';
    if (user.isAdmin()) return 'ADMIN';
    if (animal && animal.ownerId === user.id) return 'RESPONSIBLE';
    return 'USER';
  }
}
