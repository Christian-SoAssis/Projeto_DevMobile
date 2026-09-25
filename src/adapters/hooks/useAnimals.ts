import { useState, useCallback } from 'react';
import { Animal } from '../../domain/entities/Animal';
import { AnimalFilterOptions, AnimalRepository } from '../../domain/ports/AnimalRepository';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { SearchAnimalsUseCase } from '../../application/use-cases/SearchAnimalsUseCase';
import { CreateAnimalUseCase } from '../../application/use-cases/CreateAnimalUseCase';
import { MarkAnimalAdoptedUseCase } from '../../application/use-cases/MarkAnimalAdoptedUseCase';
import { AnimalRepositoryFake } from '../../application/fakes/AnimalRepositoryFake';
import { SyncQueueRepositoryFake } from '../../application/fakes/SyncQueueRepositoryFake';

export function useAnimals(
  animalRepository: AnimalRepository = new AnimalRepositoryFake(),
  syncQueueRepository: SyncQueueRepository = new SyncQueueRepositoryFake()
) {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const searchAnimals = useCallback(
    async (filters: AnimalFilterOptions = {}, online: boolean = true) => {
      setLoading(true);
      setError(null);
      try {
        const useCase = new SearchAnimalsUseCase(animalRepository);
        const result = await useCase.execute(filters, online);
        setAnimals(result.animals);
        setIsOffline(result.isOffline);
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar anúncios.');
      } finally {
        setLoading(false);
      }
    },
    [animalRepository]
  );

  const createAnimal = async (animal: Animal, online: boolean = true) => {
    setLoading(true);
    setError(null);
    try {
      const useCase = new CreateAnimalUseCase(animalRepository, syncQueueRepository);
      const res = await useCase.execute(animal, online);
      await searchAnimals({}, online);
      return res;
    } catch (err: any) {
      setError(err.message || 'Erro ao criar anúncio.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const markAdopted = async (requestorId: string, animalId: string, online: boolean = true) => {
    setLoading(true);
    setError(null);
    try {
      const useCase = new MarkAnimalAdoptedUseCase(animalRepository, syncQueueRepository);
      const updated = await useCase.execute(requestorId, animalId, online);
      await searchAnimals({}, online);
      return updated;
    } catch (err: any) {
      setError(err.message || 'Erro ao marcar como adotado.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    animals,
    loading,
    isOffline,
    error,
    searchAnimals,
    createAnimal,
    markAdopted,
  };
}
