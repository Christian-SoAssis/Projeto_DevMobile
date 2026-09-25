import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Animal } from '../../domain/entities/Animal';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { FavoriteRepository } from '../../domain/ports/FavoriteRepository';
import { AdoptionInterestRepository } from '../../domain/ports/AdoptionInterestRepository';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { ToggleFavoriteUseCase } from '../../application/use-cases/ToggleFavoriteUseCase';
import { RegisterAdoptionInterestUseCase } from '../../application/use-cases/RegisterAdoptionInterestUseCase';
import { MarkAnimalAdoptedUseCase } from '../../application/use-cases/MarkAnimalAdoptedUseCase';
import { GerarPdfUseCase } from '../../application/use-cases/GerarPdfUseCase';
import { FavoriteRepositoryFake } from '../../application/fakes/FavoriteRepositoryFake';
import { AdoptionInterestRepositoryFake } from '../../application/fakes/AdoptionInterestRepositoryFake';
import { SyncQueueRepositoryFake } from '../../application/fakes/SyncQueueRepositoryFake';

export interface AnimalDetailsScreenProps {
  animal: Animal;
  currentUserId?: string;
  animalRepository: AnimalRepository;
  favoriteRepository?: FavoriteRepository;
  interestRepository?: AdoptionInterestRepository;
  syncQueueRepository?: SyncQueueRepository;
  onBack?: () => void;
}

export const AnimalDetailsScreen: React.FC<AnimalDetailsScreenProps> = ({
  animal: initialAnimal,
  currentUserId = 'usr_2',
  animalRepository,
  favoriteRepository = new FavoriteRepositoryFake(),
  interestRepository = new AdoptionInterestRepositoryFake(),
  syncQueueRepository = new SyncQueueRepositoryFake(),
  onBack,
}) => {
  const [animal, setAnimal] = useState<Animal>(initialAnimal);
  const [isFav, setIsFav] = useState(false);
  const [hasInterest, setHasInterest] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const isOwner = animal.isOwner(currentUserId);

  useEffect(() => {
    async function checkState() {
      if (currentUserId) {
        const fav = await favoriteRepository.isFavorite(currentUserId, animal.id);
        setIsFav(fav);
        const intr = await interestRepository.hasInterest(currentUserId, animal.id);
        setHasInterest(intr);
      }
    }
    checkState();
  }, [animal.id, currentUserId]);

  const handleToggleFavorite = async () => {
    if (!currentUserId) {
      setFeedback('Faça login para favoritar.');
      return;
    }
    const useCase = new ToggleFavoriteUseCase(favoriteRepository);
    const newState = await useCase.execute(currentUserId, animal.id);
    setIsFav(newState);
    setFeedback(newState ? 'Adicionado aos favoritos!' : 'Removido dos favoritos.');
  };

  const handleDemonstrateInterest = async () => {
    if (!currentUserId) {
      setFeedback('Faça login para demonstrar interesse.');
      return;
    }
    const useCase = new RegisterAdoptionInterestUseCase(interestRepository);
    await useCase.execute(currentUserId, animal.id);
    setHasInterest(true);
    setFeedback('Manifestação de interesse enviada ao responsável!');
  };

  const handleMarkAdopted = async () => {
    try {
      const useCase = new MarkAnimalAdoptedUseCase(animalRepository, syncQueueRepository);
      const updated = await useCase.execute(currentUserId, animal.id, true);
      setAnimal(updated);
      setFeedback('Animal marcado como adotado com sucesso!');
    } catch (err: any) {
      setFeedback(err.message || 'Erro ao alterar status.');
    }
  };

  const handleExportPdf = () => {
    try {
      const useCase = new GerarPdfUseCase();
      const pdf = useCase.executeForAnimal(animal);
      setFeedback(`PDF gerado com sucesso (${pdf.pdfBase64.substring(0, 30)}...)`);
    } catch (err: any) {
      setFeedback(err.message);
    }
  };

  return (
    <ScrollView style={styles.container} testID="animal-details-screen">
      {onBack && (
        <TouchableOpacity style={styles.backButton} onPress={onBack} testID="back-button">
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
      )}

      {feedback && (
        <View style={styles.feedbackBanner} testID="feedback-message">
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>
      )}

      <View style={styles.header}>
        <Text style={styles.title} testID="animal-title">{animal.name}</Text>
        <View style={[styles.badge, animal.status.isAdopted() ? styles.badgeAdopted : styles.badgeAvailable]}>
          <Text style={styles.badgeText}>{animal.status.isAdopted() ? 'Adotado' : 'Disponível'}</Text>
        </View>
      </View>

      <Text style={styles.sectionHeader}>Características</Text>
      <View style={styles.infoCard}>
        <Text style={styles.infoLine} testID="info-species">Espécie: {animal.characteristics.species}</Text>
        <Text style={styles.infoLine} testID="info-size">Porte: {animal.characteristics.size}</Text>
        <Text style={styles.infoLine} testID="info-age">Idade aproximada: {animal.characteristics.approximateAge}</Text>
        <Text style={styles.infoLine} testID="info-sex">Sexo: {animal.characteristics.sex}</Text>
        {!!animal.characteristics.behavior && (
          <Text style={styles.infoLine}>Comportamento: {animal.characteristics.behavior}</Text>
        )}
        {!!animal.characteristics.specialCare && (
          <Text style={styles.infoLine}>Cuidados especiais: {animal.characteristics.specialCare}</Text>
        )}
      </View>

      <Text style={styles.sectionHeader}>Localização Aproximada</Text>
      <View style={styles.infoCard}>
        <Text style={styles.infoLine} testID="approx-location">
          📍 {animal.location.formatDisplayLocation()}
        </Text>
        <Text style={styles.privacyNote}>* Endereço residencial exato não é exposto por privacidade.</Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionSection}>
        <TouchableOpacity
          style={[styles.btn, isFav ? styles.btnFavActive : styles.btnFav]}
          onPress={handleToggleFavorite}
          testID="favorite-button"
        >
          <Text style={styles.btnText}>{isFav ? '❤️ Favoritado' : '🤍 Salvar nos Favoritos'}</Text>
        </TouchableOpacity>

        {!isOwner && animal.status.isAvailable() && (
          <TouchableOpacity
            style={[styles.btn, hasInterest ? styles.btnDisabled : styles.btnPrimary]}
            onPress={handleDemonstrateInterest}
            disabled={hasInterest}
            testID="interest-button"
          >
            <Text style={styles.btnText}>
              {hasInterest ? 'Interesse Registrado' : '🤝 Demonstrar Interesse'}
            </Text>
          </TouchableOpacity>
        )}

        {isOwner && animal.status.isAvailable() && (
          <TouchableOpacity
            style={[styles.btn, styles.btnSuccess]}
            onPress={handleMarkAdopted}
            testID="mark-adopted-button"
          >
            <Text style={styles.btnText}>🎉 Marcar como Adotado</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={handleExportPdf} testID="export-pdf-button">
          <Text style={styles.btnText}>📄 Gerar PDF do Anúncio</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
    marginBottom: 12,
  },
  backText: {
    fontSize: 16,
    color: '#0066cc',
    fontWeight: 'bold',
  },
  feedbackBanner: {
    backgroundColor: '#d1ecf1',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  feedbackText: {
    color: '#0c5460',
    fontSize: 14,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1c1c1e',
  },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  badgeAvailable: {
    backgroundColor: '#28a745',
  },
  badgeAdopted: {
    backgroundColor: '#6c757d',
  },
  badgeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3a3a3c',
    marginTop: 12,
    marginBottom: 8,
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 8,
    marginBottom: 12,
    borderColor: '#e5e5ea',
    borderWidth: 1,
  },
  infoLine: {
    fontSize: 14,
    color: '#333',
    marginBottom: 6,
  },
  privacyNote: {
    fontSize: 12,
    color: '#8e8e93',
    fontStyle: 'italic',
    marginTop: 4,
  },
  actionSection: {
    marginTop: 16,
    marginBottom: 32,
  },
  btn: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnPrimary: {
    backgroundColor: '#0066cc',
  },
  btnSuccess: {
    backgroundColor: '#28a745',
  },
  btnFav: {
    backgroundColor: '#6c757d',
  },
  btnFavActive: {
    backgroundColor: '#dc3545',
  },
  btnSecondary: {
    backgroundColor: '#17a2b8',
  },
  btnDisabled: {
    backgroundColor: '#a5a5a5',
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
