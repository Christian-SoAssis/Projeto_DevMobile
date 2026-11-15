import { Animal } from '../entities/Animal';

export type ModerationAction = 'HIDE' | 'UNHIDE';

export interface ModerationGateway {
  listAllForModeration(): Promise<Animal[]>;
  moderateAnimal(animalId: string, action: ModerationAction): Promise<void>;
}
