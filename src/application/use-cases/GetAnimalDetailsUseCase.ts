import { Animal } from '../../domain/entities/Animal';
import { AdoptionInterest } from '../../domain/entities/AdoptionInterest';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { AdoptionInterestRepository } from '../../domain/ports/AdoptionInterestRepository';
import { FavoriteRepository } from '../../domain/ports/FavoriteRepository';
import { RemoteAnimalSource } from '../../domain/ports/RemoteAnimalSource';
import { PullRemoteInterestsUseCase } from './PullRemoteInterestsUseCase';

export interface AnimalFullDetailsResult {
  animal: Animal | null;
  isFavorite: boolean;
  interests: AdoptionInterest[];
  myInterest: AdoptionInterest | null;
  withdrawalDetected: boolean;
}

export class GetAnimalDetailsUseCase {
  constructor(
    private animalRepository: AnimalRepository,
    private remoteAnimalSource?: RemoteAnimalSource,
    private favoriteRepository?: FavoriteRepository,
    private interestRepository?: AdoptionInterestRepository,
    private pullRemoteInterestsUseCase?: PullRemoteInterestsUseCase
  ) {}

  async execute(id: string, isOnline: boolean = true): Promise<Animal | null> {
    const local = await this.animalRepository.findById(id);
    if (local) return local;

    if (isOnline && this.remoteAnimalSource) {
      try {
        const remote = await this.remoteAnimalSource.findById(id);
        if (remote) {
          await this.animalRepository.upsertCache([remote]);
          return remote;
        }
      } catch {
        // Fallback para null quando offline ou falha de rede
      }
    }
    return null;
  }

  /**
   * Carrega em uma única operação de aplicação o animal, status de favorito
   * e a lista de interesses sincronizada (local + remoto + detecção de desistências).
   */
  async loadFullDetails(params: {
    animalId: string;
    currentUserId: string | null;
    isOnline: boolean;
  }): Promise<AnimalFullDetailsResult> {
    const animal = await this.execute(params.animalId, params.isOnline);
    if (!animal) {
      return {
        animal: null,
        isFavorite: false,
        interests: [],
        myInterest: null,
        withdrawalDetected: false,
      };
    }

    const isFavorite =
      params.currentUserId && this.favoriteRepository
        ? await this.favoriteRepository.isFavorite(params.currentUserId, animal.id)
        : false;

    let interests: AdoptionInterest[] = [];
    let withdrawalDetected = false;

    if (this.pullRemoteInterestsUseCase) {
      const synced = await this.pullRemoteInterestsUseCase.syncForAnimal(
        animal,
        params.currentUserId,
        params.isOnline
      );
      interests = synced.interests;
      withdrawalDetected = synced.withdrawalDetected;
    } else if (this.interestRepository) {
      interests = await this.interestRepository.listByAnimal(animal.id);
    }

    const myInterest = params.currentUserId
      ? interests.find((i) => i.userId === params.currentUserId) ?? null
      : null;

    return {
      animal,
      isFavorite,
      interests,
      myInterest,
      withdrawalDetected,
    };
  }
}
