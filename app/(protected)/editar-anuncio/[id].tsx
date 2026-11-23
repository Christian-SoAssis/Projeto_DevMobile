import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../src/adapters/context/AuthContext';
import { useConnectivity } from '../../../src/adapters/hooks/useConnectivity';
import { useFullSync } from '../../../src/adapters/hooks/useFullSync';
import { useUseCases } from '../../../src/adapters/hooks/useUseCases';
import { useAnimalForm } from '../../../src/adapters/hooks/useAnimalForm';
import { notifyPullCompleted } from '../../../src/adapters/sync/pullEvents';
import { EnlaceHeader } from '../../../src/adapters/components/EnlaceHeader';
import { AnimalForm } from '../../../src/adapters/components/AnimalForm';
import { COLORS } from '../../../src/adapters/theme/tokens';

export default function EditarAnuncioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const isOnline = useConnectivity();
  const runFullSync = useFullSync();
  const { getAnimalDetailsUseCase, updateAnimalUseCase } = useUseCases();

  const [loading, setLoading] = useState(true);
  const form = useAnimalForm('');

  useEffect(() => {
    async function load() {
      if (!id) return;
      const existing = await getAnimalDetailsUseCase.execute(id, isOnline);
      if (existing) {
        form.hydrateFromAnimal(existing);
      }
      setLoading(false);
    }
    void load();
  }, [id, getAnimalDetailsUseCase, isOnline, form.hydrateFromAnimal]);

  const handleSave = async () => {
    if (!user || !id) return;
    if (form.photos.length === 0) {
      Alert.alert('Foto obrigatória', 'Mantenha pelo menos 1 foto no anúncio.');
      return;
    }
    form.setSaving(true);
    try {
      const { characteristics, location } = form.buildValueObjects();
      await updateAnimalUseCase.execute({
        animalId: id,
        actorUserId: user.id,
        name: form.name.trim(),
        characteristics,
        location,
        photos: form.toDomainPhotos(id),
        isOnline,
      });
      notifyPullCompleted();
      void runFullSync();
      router.replace(`/animal/${id}`);
    } catch (err: any) {
      Alert.alert('Erro ao atualizar', err?.message || 'Não foi possível salvar as alterações.');
    } finally {
      form.setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EnlaceHeader showBack onBack={() => router.back()} title="Editar anúncio" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.terracotta} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <EnlaceHeader showBack onBack={() => router.back()} title="Editar anúncio" />
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
        submitLabel="Salvar alterações"
        savingLabel="Salvando..."
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
