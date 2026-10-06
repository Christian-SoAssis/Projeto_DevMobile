import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Animal } from '../../domain/entities/Animal';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { DeleteAnimalUseCase } from '../../application/use-cases/DeleteAnimalUseCase';
import { MarkAnimalAdoptedUseCase } from '../../application/use-cases/MarkAnimalAdoptedUseCase';
import { SyncQueueRepositoryFake } from '../../application/fakes/SyncQueueRepositoryFake';

export interface MyAnimalsScreenProps {
  animalRepository: AnimalRepository;
  syncQueueRepository?: SyncQueueRepository;
  ownerId?: string;
  onSelectAnimal?: (animal: Animal) => void;
  onEditAnimal?: (animal: Animal) => void;
  onNewAnimal?: () => void;
  onBack?: () => void;
  isOnline?: boolean;
}

export const MyAnimalsScreen: React.FC<MyAnimalsScreenProps> = ({
  animalRepository,
  syncQueueRepository = new SyncQueueRepositoryFake(),
  ownerId = 'usr_1',
  onSelectAnimal,
  onEditAnimal,
  onNewAnimal,
  onBack,
  isOnline = true,
}) => {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadAnimals = useCallback(async () => {
    setLoading(true);
    try {
      setAnimals(await animalRepository.listByOwner(ownerId));
    } finally {
      setLoading(false);
    }
  }, [animalRepository, ownerId]);

  useEffect(() => {
    loadAnimals();
  }, [loadAnimals]);

  const handleDelete = async (id: string) => {
    setFeedback(null);
    try {
      const useCase = new DeleteAnimalUseCase(animalRepository, syncQueueRepository);
      await useCase.execute(ownerId, id, isOnline);
      setFeedback('Anúncio excluído com sucesso!');
      await loadAnimals();
    } catch (err: any) {
      setFeedback(err.message || 'Erro ao excluir anúncio.');
    }
  };

  const handleMarkAdopted = async (id: string) => {
    setFeedback(null);
    try {
      const useCase = new MarkAnimalAdoptedUseCase(animalRepository, syncQueueRepository);
      await useCase.execute(ownerId, id, isOnline);
      setFeedback('Animal marcado como adotado com sucesso!');
      await loadAnimals();
    } catch (err: any) {
      setFeedback(err.message || 'Erro ao marcar como adotado.');
    }
  };

  return (
    <View style={styles.container} testID="my-animals-screen">
      {onBack && (
        <TouchableOpacity style={styles.backButton} onPress={onBack} testID="my-animals-back">
          <Text style={styles.backText}>‹ Voltar</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.title} testID="my-animals-title">
        Meus Anúncios ({animals.length})
      </Text>
      {onNewAnimal && (
        <TouchableOpacity
          style={styles.newButton}
          onPress={onNewAnimal}
          testID="new-animal-button"
        >
          <Text style={styles.newButtonText}>＋ Novo anúncio</Text>
        </TouchableOpacity>
      )}
      {feedback && (
        <View style={styles.feedbackBanner} testID="my-animals-feedback">
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>
      )}
      {loading ? (
        <ActivityIndicator size="large" color="#0066cc" testID="my-animals-loading" />
      ) : (
        <FlatList
          data={animals}
          keyExtractor={(item) => item.id}
          testID="my-animals-list"
          ListEmptyComponent={
            <Text style={styles.emptyText} testID="empty-my-animals">
              Você ainda não publicou nenhum anúncio.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card} testID={`my-animal-item-${item.id}`}>
              <TouchableOpacity
                onPress={() => onSelectAnimal && onSelectAnimal(item)}
                testID={`my-animal-card-${item.id}`}
              >
                <Text style={styles.animalName}>{item.name}</Text>
                <Text style={styles.animalDetails}>{item.characteristics.summary()}</Text>
                <Text style={styles.statusText}>
                  {item.status.isAdopted() ? 'Adotado' : 'Disponível'}
                </Text>
              </TouchableOpacity>
              <View style={styles.actionsRow}>
                {onEditAnimal && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.editBtn]}
                    onPress={() => onEditAnimal(item)}
                    testID={`my-animal-edit-${item.id}`}
                  >
                    <Text style={styles.actionText}>Editar</Text>
                  </TouchableOpacity>
                )}
                {item.status.isAvailable() && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.adoptedBtn]}
                    onPress={() => handleMarkAdopted(item.id)}
                    testID={`my-animal-adopted-${item.id}`}
                  >
                    <Text style={styles.actionText}>Adotado</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionBtn, styles.deleteBtn]}
                  onPress={() => handleDelete(item.id)}
                  testID={`my-animal-delete-${item.id}`}
                >
                  <Text style={styles.actionText}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#f5f5f7',
    padding: 16,
  },
  backButton: {
    marginBottom: 8,
  },
  backText: {
    color: '#0066cc',
    fontSize: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1c1c1e',
    marginBottom: 12,
  },
  newButton: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  newButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderColor: '#e5e5ea',
    borderWidth: 1,
  },
  animalName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1c1c1e',
  },
  animalDetails: {
    fontSize: 14,
    color: '#48484a',
    marginTop: 4,
  },
  statusText: {
    fontSize: 13,
    color: '#28a745',
    fontWeight: 'bold',
    marginTop: 4,
  },
  feedbackBanner: {
    backgroundColor: '#d1ecf1',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  feedbackText: {
    color: '#0c5460',
    fontWeight: 'bold',
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  actionBtn: {
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  editBtn: {
    backgroundColor: '#0066cc',
  },
  adoptedBtn: {
    backgroundColor: '#28a745',
  },
  deleteBtn: {
    backgroundColor: '#dc3545',
  },
  actionText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 24,
    color: '#8e8e93',
  },
});
