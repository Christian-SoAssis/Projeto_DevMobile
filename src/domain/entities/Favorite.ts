export interface FavoriteProps {
  userId: string;
  animalId: string;
  createdAt?: string;
}

export class Favorite {
  public readonly userId: string;
  public readonly animalId: string;
  public readonly createdAt: string;

  constructor(props: FavoriteProps) {
    if (!props.userId || !props.animalId) {
      throw new Error('Favorito exige usuário e anúncio válidos.');
    }
    this.userId = props.userId;
    this.animalId = props.animalId;
    this.createdAt = props.createdAt ?? new Date().toISOString();
  }
}
