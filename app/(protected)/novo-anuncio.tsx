import React, { useMemo, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRepositories } from '../../src/adapters/context/RepositoriesContext';
import { useAuth } from '../../src/adapters/context/AuthContext';
import { useConnectivity } from '../../src/adapters/hooks/useConnectivity';
import { useFullSync } from '../../src/adapters/hooks/useFullSync';
import { EnlaceHeader } from '../../src/adapters/components/EnlaceHeader';
import { Animal } from '../../src/domain/entities/Animal';
import { AnimalPhoto } from '../../src/domain/entities/AnimalPhoto';
import { AnimalCharacteristics } from '../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../src/domain/value-objects/ApproximateLocation';
import { CreateAnimalUseCase } from '../../src/application/use-cases/CreateAnimalUseCase';
import { generateUuid } from '../../src/domain/services/IdGenerator';
import {
  CLAY_CARD_STYLE,
  CLAY_INSET_INPUT_STYLE,
  CLAY_PRIMARY_BUTTON_STYLE,
  COLORS,
  RADII,
  SPACING,
} from '../../src/adapters/theme/tokens';

export default function NovoAnuncioScreen() {
  const router = useRouter();
  const container = useRepositories();
  const { user } = useAuth();
  const isOnline = useConnectivity();
  const runFullSync = useFullSync();

  const [photos, setPhotos] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<'Cão' | 'Gato'>('Cão');
  const [sex, setSex] = useState<'Fêmea' | 'Macho'>('Fêmea');
  const [size, setSize] = useState<'Pequeno' | 'Médio' | 'Grande'>('Médio');
  const [approximateAge, setApproximateAge] = useState('');
  const [behavior, setBehavior] = useState('');
  const [specialCare, setSpecialCare] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('Varginha');
  const [latitude, setLatitude] = useState(-21.55);
  const [longitude, setLongitude] = useState(-45.43);
  const [locGeocoded, setLocGeocoded] = useState(true);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  const createUseCase = useMemo(
    () =>
      new CreateAnimalUseCase(
        container.animalRepository,
        container.syncQueueRepository,
        container.photoStorage,
        container.unitOfWork,
        container.remoteAnimalSource,
        container.remotePhotoStorage
      ),
    [container]
  );

  const handleCaptureCamera = async () => {
    if (photos.length >= 4) {
      Alert.alert('Limite atingido', 'Cada anúncio pode ter até 4 fotos.');
      return;
    }
    const res = await container.cameraGateway.capturePhoto();
    if (res?.uri) setPhotos((prev) => [...prev, res.uri].slice(0, 4));
  };

  const handlePickGallery = async () => {
    if (photos.length >= 4) {
      Alert.alert('Limite atingido', 'Cada anúncio pode ter até 4 fotos.');
      return;
    }
    const res = await container.cameraGateway.pickImageFromGallery();
    if (res?.uri) setPhotos((prev) => [...prev, res.uri].slice(0, 4));
  };

  const handleUseMyLocation = async () => {
    setLocating(true);
    try {
      const loc = await container.locationGateway.getCurrentLocation();
      setNeighborhood(loc.neighborhood);
      setCity(loc.city);
      setLatitude(loc.latitude);
      setLongitude(loc.longitude);
      setLocGeocoded(loc.geocoded);
      if (!loc.geocoded) {
        Alert.alert(
          'Localização aproximada',
          'Não foi possível identificar o bairro e a cidade automaticamente. Preencha manualmente.'
        );
      }
    } catch {
      Alert.alert('Localização', 'Preencha o bairro e a cidade manualmente.');
    } finally {
      setLocating(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (photos.length === 0) {
      Alert.alert('Foto obrigatória', 'Adicione pelo menos 1 foto do animal.');
      return;
    }
    if (!name.trim() || !approximateAge.trim() || !neighborhood.trim() || !city.trim()) {
      Alert.alert('Campos obrigatórios', 'Preencha nome, idade aproximada, bairro e cidade.');
      return;
    }

    setSaving(true);
    try {
      const animalId = generateUuid();
      const animalPhotos = photos.map(
        (uri) =>
          new AnimalPhoto({
            animalId,
            localPath: uri,
          })
      );

      const animal = new Animal({
        id: animalId,
        ownerId: user.id,
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
        photos: animalPhotos,
      });

      await createUseCase.execute(animal, isOnline);
      void runFullSync();
      router.replace('/(tabs)/meus-anuncios');
    } catch (err: any) {
      Alert.alert('Erro ao salvar', err?.message || 'Verifique os campos preenchidos.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <EnlaceHeader showBack onBack={() => router.back()} title="Novo anúncio" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Fotos do pet ({photos.length}/4)</Text>
          <View style={styles.photoGrid}>
            {photos.map((uri, index) => (
              <View key={`${uri}-${index}`} style={styles.photoThumbWrap}>
                <Image source={{ uri }} style={styles.photoThumb} />
                <Pressable
                  style={styles.removePhotoBtn}
                  onPress={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Ionicons name="close" size={14} color={COLORS.white} />
                </Pressable>
              </View>
            ))}
          </View>
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
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Nome do animal</Text>
          <TextInput
            style={CLAY_INSET_INPUT_STYLE}
            value={name}
            onChangeText={setName}
            placeholder="Ex.: Amora, Bento..."
            placeholderTextColor={COLORS.brownMuted}
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
            placeholder="Ex.: 8 meses, 2 anos"
            placeholderTextColor={COLORS.brownMuted}
            maxLength={30}
          />

          <Text style={styles.label}>Comportamento (opcional)</Text>
          <TextInput
            style={[CLAY_INSET_INPUT_STYLE, styles.textArea]}
            value={behavior}
            onChangeText={setBehavior}
            placeholder="Conte como é o temperamento, convivência com outros animais..."
            placeholderTextColor={COLORS.brownMuted}
            maxLength={500}
            multiline
          />

          <Text style={styles.label}>Cuidados especiais (opcional)</Text>
          <TextInput
            style={CLAY_INSET_INPUT_STYLE}
            value={specialCare}
            onChangeText={setSpecialCare}
            placeholder="Ex.: Vacinado, castrado, medicação..."
            placeholderTextColor={COLORS.brownMuted}
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
            placeholder="Ex.: Centro, Vila Pinto"
            placeholderTextColor={COLORS.brownMuted}
            maxLength={60}
          />

          <Text style={styles.label}>Cidade</Text>
          <TextInput
            style={CLAY_INSET_INPUT_STYLE}
            value={city}
            onChangeText={setCity}
            placeholder="Ex.: Varginha"
            placeholderTextColor={COLORS.brownMuted}
            maxLength={60}
          />
          {!locGeocoded && !locating && (
            <Text style={styles.locNotGeocodedText}>
              Bairro/cidade não identificados automaticamente — preenchidos com valores padrão.
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={CLAY_PRIMARY_BUTTON_STYLE}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Salvando anúncio...' : 'Salvar anúncio'}
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
  locNotGeocodedText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.brown,
    marginTop: 4,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '900',
  },
});
