import { Favorite } from '../../domain/entities/Favorite';
import { FavoriteRepository } from '../../domain/ports/FavoriteRepository';

export class ToggleFavoriteUseCase {
  constructor(private favoriteRepository: FavoriteRepository) {}

  async execute(userId: string, animalId: string): Promise<boolean> {
    if (!userId) throw new Error('Usuário autenticado é obrigatório para favoritar.');
    if (!animalId) throw new Error('ID do animal é obrigatório.');

    const isFav = await this.favoriteRepository.isFavorite(userId, animalId);
    if (isFav) {
      await this.favoriteRepository.removeFavorite(userId, animalId);
      return false;
    } else {
      const fav = new Favorite(userId, animalId);
      await this.favoriteRepository.addFavorite(fav);
      return true;
    }
  }
}
