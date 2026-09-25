export class Favorite {
  readonly userId: string;
  readonly animalId: string;
  readonly createdAt: string;

  constructor(userId: string, animalId: string, createdAt?: string) {
    if (!userId) throw new Error('ID do usuário é obrigatório.');
    if (!animalId) throw new Error('ID do animal é obrigatório.');

    this.userId = userId;
    this.animalId = animalId;
    this.createdAt = createdAt || new Date().toISOString();
  }
}
