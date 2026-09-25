export class AdoptionInterest {
  readonly id: string;
  readonly userId: string;
  readonly animalId: string;
  readonly createdAt: string;

  constructor(id: string, userId: string, animalId: string, createdAt?: string) {
    if (!id) throw new Error('ID do interesse é obrigatório.');
    if (!userId) throw new Error('ID do usuário é obrigatório.');
    if (!animalId) throw new Error('ID do animal é obrigatório.');

    this.id = id;
    this.userId = userId;
    this.animalId = animalId;
    this.createdAt = createdAt || new Date().toISOString();
  }
}
