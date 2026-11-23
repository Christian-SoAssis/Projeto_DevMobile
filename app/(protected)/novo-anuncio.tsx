import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/adapters/context/AuthContext';
import { useConnectivity } from '../../src/adapters/hooks/useConnectivity';
import { useFullSync } from '../../src/adapters/hooks/useFullSync';
import { useUseCases } from '../../src/adapters/hooks/useUseCases';
import { useAnimalForm } from '../../src/adapters/hooks/useAnimalForm';
import { EnlaceHeader } from '../../src/adapters/components/EnlaceHeader';
import { AnimalForm } from '../../src/adapters/components/AnimalForm';
import { Animal } from '../../src/domain/entities/Animal';
import { generateUuid } from '../../src/domain/services/IdGenerator';
import { COLORS } from '../../src/adapters/theme/tokens';

export default function NovoAnuncioScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isOnline = useConnectivity();
  const runFullSync = useFullSync();
  const { createAnimalUseCase } = useUseCases();

  const form = useAnimalForm('Varginha');

  const handleSave = async () => {
    if (!user) return;
    if (form.photos.length === 0) {
      Alert.alert('Foto obrigatória', 'Adicione pelo menos 1 foto do animal.');
      return;
    }
    if (
      !form.name.trim() ||
      !form.approximateAge.trim() ||
      !form.neighborhood.trim() ||
      !form.city.trim()
    ) {
      Alert.alert(
        'Campos obrigatórios',
        'Preencha nome, idade aproximada, bairro e cidade.'
      );
      return;
    }

    form.setSaving(true);
    try {
      const animalId = generateUuid();
      const { characteristics, location } = form.buildValueObjects();
      const animal = new Animal({
        id: animalId,
        ownerId: user.id,
        name: form.name.trim(),
        characteristics,
        location,
        photos: form.toDomainPhotos(animalId),
      });

      await createAnimalUseCase.execute(animal, isOnline);
      void runFullSync();
      router.replace('/(tabs)/meus-anuncios');
    } catch (err: any) {
      Alert.alert('Erro ao salvar', err?.message || 'Verifique os campos preenchidos.');
    } finally {
      form.setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <EnlaceHeader showBack onBack={() => router.back()} title="Novo anúncio" />
      <AnimalForm
        photos={form.photos}
        onCaptureCamera={form.handleCaptureCamera}
        onPickGallery={form.handlePickGallery}
        onRemovePhotoAt={form.removePhotoAt}
        name={form.name}
        onChangeName={form.setName}
        species={form.species}
        onChangeSpecies={form.setSpecies}
        sex={form.sex}
        onChangeSex={form.setSex}
        size={form.size}
        onChangeSize={form.setSize}
        approximateAge={form.approximateAge}
        onChangeApproximateAge={form.setApproximateAge}
        behavior={form.behavior}
        onChangeBehavior={form.setBehavior}
        specialCare={form.specialCare}
        onChangeSpecialCare={form.setSpecialCare}
        neighborhood={form.neighborhood}
        onChangeNeighborhood={form.setNeighborhood}
        city={form.city}
        onChangeCity={form.setCity}
        locGeocoded={form.locGeocoded}
        locating={form.locating}
        onUseMyLocation={form.handleUseMyLocation}
        saving={form.saving}
        submitLabel="Salvar anúncio"
        savingLabel="Salvando anúncio..."
        onSubmit={handleSave}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.ivory,
  },
});
