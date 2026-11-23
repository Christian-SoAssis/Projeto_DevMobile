import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRepositories } from '../../../src/adapters/context/RepositoriesContext';
import { useAuth } from '../../../src/adapters/context/AuthContext';
import { useConnectivity } from '../../../src/adapters/hooks/useConnectivity';
import { useFullSync } from '../../../src/adapters/hooks/useFullSync';
import { useUseCases } from '../../../src/adapters/hooks/useUseCases';
import { notifyPullCompleted } from '../../../src/adapters/sync/pullEvents';
import { EnlaceHeader } from '../../../src/adapters/components/EnlaceHeader';
import { AnimalPhoto } from '../../../src/domain/entities/AnimalPhoto';
import { AnimalCharacteristics } from '../../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../../src/domain/value-objects/ApproximateLocation';
import {
  CLAY_CARD_STYLE,
  CLAY_INSET_INPUT_STYLE,
  CLAY_PRIMARY_BUTTON_STYLE,
  COLORS,
  RADII,
  SPACING,
} from '../../../src/adapters/theme/tokens';

export default function EditarAnuncioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const container = useRepositories();
  const { user } = useAuth();
  const isOnline = useConnectivity();
  const runFullSync = useFullSync();
  const { updateAnimalUseCase } = useUseCases();

  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<AnimalPhoto[]>([]);
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('Cão');
  const [sex, setSex] = useState('Fêmea');
  const [size, setSize] = useState('Médio');
  const [approximateAge, setApproximateAge] = useState('');
  const [behavior, setBehavior] = useState('');
  const [specialCare, setSpecialCare] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [latitude, setLatitude] = useState(-21.55);
  const [longitude, setLongitude] = useState(-45.43);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const existing = await container.animalRepository.findById(id);
      if (existing) {
        setName(existing.name);
        setSpecies(existing.characteristics.species);
        setSex(existing.characteristics.sex);
        setSize(existing.characteristics.size);
        setApproximateAge(existing.characteristics.approximateAge);
        setBehavior(existing.characteristics.behavior);
        setSpecialCare(existing.characteristics.specialCare);
        setNeighborhood(existing.location.neighborhood);
        setCity(existing.location.city);
        setLatitude(existing.location.latitude);
        setLongitude(existing.location.longitude);
        setPhotos(existing.photos);
      }
      setLoading(false);
    }
    void load();
  }, [id, container]);

  const handleCaptureCamera = async () => {
    if (!id) return;
    if (photos.length >= 4) {
      Alert.alert('Limite atingido', 'Cada anúncio pode ter até 4 fotos.');
      return;
    }
    const res = await container.cameraGateway.capturePhoto();
    if (res?.uri) {
      setPhotos((prev) => [
        ...prev,
        new AnimalPhoto({
          animalId: id,
          localPath: res.uri,
        }),
      ]);
    }
  };

  const handlePickGallery = async () => {
    if (!id) return;
    if (photos.length >= 4) {
      Alert.alert('Limite atingido', 'Cada anúncio pode ter até 4 fotos.');
      return;
    }
    const res = await container.cameraGateway.pickImageFromGallery();
    if (res?.uri) {
      setPhotos((prev) => [
        ...prev,
        new AnimalPhoto({
          animalId: id,
          localPath: res.uri,
        }),
      ]);
    }
  };

  const handleUseMyLocation = async () => {
    setLocating(true);
    try {
      const loc = await container.locationGateway.getCurrentLocation();
      setNeighborhood(loc.neighborhood);
      setCity(loc.city);
      setLatitude(loc.latitude);
      setLongitude(loc.longitude);
    } catch {
      Alert.alert('Localização', 'Preencha o bairro e a cidade manualmente.');
    } finally {
      setLocating(false);
    }
  };

  const handleSave = async () => {
    if (!user || !id) return;
    if (photos.length === 0) {
      Alert.alert('Foto obrigatória', 'Mantenha pelo menos 1 foto no anúncio.');
      return;
    }
    setSaving(true);
    try {
      await updateAnimalUseCase.execute({
        animalId: id,
        actorUserId: user.id,
        name: name.trim(),
        characteristics: new AnimalCharacteristics({
          species,
          size,
          approximateAge: approximateAge.trim(),
          sex,
          behavior: behavior.trim(),
          specialCare: specialCare.trim(),
        }),
        location: new ApproximateLocation({
          neighborhood: neighborhood.trim(),
          city: city.trim(),
          latitude,
          longitude,
        }),
        photos,
        isOnline,
      });
      notifyPullCompleted();
      void runFullSync();
      router.replace(`/animal/${id}`);
    } catch (err: any) {
      Alert.alert('Erro ao atualizar', err?.message || 'Não foi possível salvar as alterações.');
    } finally {
      setSaving(false);
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

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Fotos ({photos.length}/4)</Text>
          <View style={styles.photoGrid}>
            {photos.map((photo, index) => (
              <View key={photo.id} style={styles.photoThumbWrap}>
                <Image source={{ uri: photo.displayUri }} style={styles.photoThumb} />
                <Pressable
                  style={styles.removePhotoBtn}
                  onPress={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Ionicons name="close" size={14} color={COLORS.white} />
                </Pressable>
              </View>
            ))}
          </View>
          {photos.length < 4 && (
            <View style={styles.photoButtonsRow}>
              <TouchableOpacity style={styles.photoActionBtn} onPress={handleCaptureCamera}>
                <Ionicons name="camera-outline" size={18} color={COLORS.terracotta} />
                <Text style={styles.photoActionText}>Câmera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoActionBtn} onPress={handlePickGallery}>
                <Ionicons name="images-outline" size={18} color={COLORS.terracotta} />
                <Text style={styles.photoActionText}>Galeria</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Nome do animal</Text>
          <TextInput
            style={CLAY_INSET_INPUT_STYLE}
            value={name}
            onChangeText={setName}
            maxLength={60}
          />

          <Text style={styles.label}>Espécie</Text>
          <View style={styles.chipsRow}>
            {(['Cão', 'Gato'] as const).map((sp) => (
              <Pressable
                key={sp}
                style={[styles.chip, species === sp && styles.chipActive]}
                onPress={() => setSpecies(sp)}
              >
                <Text style={[styles.chipText, species === sp && styles.chipTextActive]}>{sp}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Sexo</Text>
          <View style={styles.chipsRow}>
            {(['Fêmea', 'Macho'] as const).map((sx) => (
              <Pressable
                key={sx}
                style={[styles.chip, sex === sx && styles.chipActive]}
                onPress={() => setSex(sx)}
              >
                <Text style={[styles.chipText, sex === sx && styles.chipTextActive]}>{sx}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Porte</Text>
          <View style={styles.chipsRow}>
            {(['Pequeno', 'Médio', 'Grande'] as const).map((sz) => (
              <Pressable
                key={sz}
                style={[styles.chip, size === sz && styles.chipActive]}
                onPress={() => setSize(sz)}
              >
                <Text style={[styles.chipText, size === sz && styles.chipTextActive]}>{sz}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Idade aproximada</Text>
          <TextInput
            style={CLAY_INSET_INPUT_STYLE}
            value={approximateAge}
            onChangeText={setApproximateAge}
            maxLength={30}
          />

          <Text style={styles.label}>Comportamento</Text>
          <TextInput
            style={[CLAY_INSET_INPUT_STYLE, styles.textArea]}
            value={behavior}
            onChangeText={setBehavior}
            maxLength={500}
            multiline
          />

          <Text style={styles.label}>Cuidados especiais</Text>
          <TextInput
            style={CLAY_INSET_INPUT_STYLE}
            value={specialCare}
            onChangeText={setSpecialCare}
            maxLength={500}
          />
        </View>

        <View style={styles.card}>
          <View style={styles.locHeader}>
            <Text style={styles.sectionTitle}>Localização aproximada</Text>
            <TouchableOpacity
              style={styles.gpsButton}
              onPress={handleUseMyLocation}
              disabled={locating}
            >
              {locating ? (
                <ActivityIndicator size="small" color={COLORS.green} />
              ) : (
                <>
                  <Ionicons name="locate-outline" size={16} color={COLORS.green} />
                  <Text style={styles.gpsButtonText}>Usar minha localização</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Bairro</Text>
          <TextInput
            style={CLAY_INSET_INPUT_STYLE}
            value={neighborhood}
            onChangeText={setNeighborhood}
            maxLength={60}
          />

          <Text style={styles.label}>Cidade</Text>
          <TextInput
            style={CLAY_INSET_INPUT_STYLE}
            value={city}
            onChangeText={setCity}
            maxLength={60}
          />
        </View>

        <TouchableOpacity
          style={CLAY_PRIMARY_BUTTON_STYLE}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
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
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl * 2,
    gap: SPACING.md,
  },
  card: {
    ...CLAY_CARD_STYLE,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.espresso,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  photoThumbWrap: {
    width: 74,
    height: 74,
    borderRadius: RADII.md,
    overflow: 'hidden',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButtonsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  photoActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.amberBg,
  },
  photoActionText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.terracotta,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.brown,
    marginTop: 4,
  },
  textArea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADII.pill,
    backgroundColor: COLORS.ivory,
    borderWidth: 1,
    borderColor: COLORS.peach,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: COLORS.terracotta,
    borderColor: COLORS.terracotta,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.brown,
  },
  chipTextActive: {
    color: COLORS.white,
  },
  locHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.greenBg,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADII.pill,
  },
  gpsButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.green,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '900',
  },
});
