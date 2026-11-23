import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { Animal, MAX_PHOTOS_PER_ANIMAL } from '../../domain/entities/Animal';
import { AnimalPhoto } from '../../domain/entities/AnimalPhoto';
import { AnimalCharacteristics } from '../../domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../domain/value-objects/ApproximateLocation';
import { useRepositories } from '../context/RepositoriesContext';

export interface AnimalFormPhotoItem {
  id?: string;
  uri: string;
  original?: AnimalPhoto;
}

export function useAnimalForm(defaultCity: string = 'Varginha') {
  const container = useRepositories();

  const [photos, setPhotos] = useState<AnimalFormPhotoItem[]>([]);
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<string>('Cão');
  const [sex, setSex] = useState<string>('Fêmea');
  const [size, setSize] = useState<string>('Médio');
  const [approximateAge, setApproximateAge] = useState('');
  const [behavior, setBehavior] = useState('');
  const [specialCare, setSpecialCare] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState(defaultCity);
  const [latitude, setLatitude] = useState(-21.55);
  const [longitude, setLongitude] = useState(-45.43);
  const [locGeocoded, setLocGeocoded] = useState(true);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  const hydrateFromAnimal = useCallback((existing: Animal) => {
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
    setPhotos(
      existing.photos.map((p) => ({
        id: p.id,
        uri: p.displayUri,
        original: p,
      }))
    );
  }, []);

  const handleCaptureCamera = useCallback(async () => {
    if (photos.length >= MAX_PHOTOS_PER_ANIMAL) {
      Alert.alert(
        'Limite atingido',
        `Cada anúncio pode ter até ${MAX_PHOTOS_PER_ANIMAL} fotos.`
      );
      return;
    }
    const res = await container.cameraGateway.capturePhoto();
    if (res?.uri) {
      setPhotos((prev) =>
        [...prev, { uri: res.uri }].slice(0, MAX_PHOTOS_PER_ANIMAL)
      );
    }
  }, [photos.length, container]);

  const handlePickGallery = useCallback(async () => {
    if (photos.length >= MAX_PHOTOS_PER_ANIMAL) {
      Alert.alert(
        'Limite atingido',
        `Cada anúncio pode ter até ${MAX_PHOTOS_PER_ANIMAL} fotos.`
      );
      return;
    }
    const res = await container.cameraGateway.pickImageFromGallery();
    if (res?.uri) {
      setPhotos((prev) =>
        [...prev, { uri: res.uri }].slice(0, MAX_PHOTOS_PER_ANIMAL)
      );
    }
  }, [photos.length, container]);

  const removePhotoAt = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUseMyLocation = useCallback(async () => {
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
  }, [container]);

  const buildValueObjects = useCallback(() => {
    const characteristics = new AnimalCharacteristics({
      species,
      size,
      approximateAge: approximateAge.trim(),
      sex,
      behavior: behavior.trim(),
      specialCare: specialCare.trim(),
    });
    const location = new ApproximateLocation({
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      latitude,
      longitude,
    });
    return { characteristics, location };
  }, [
    species,
    size,
    approximateAge,
    sex,
    behavior,
    specialCare,
    neighborhood,
    city,
    latitude,
    longitude,
  ]);

  const toDomainPhotos = useCallback(
    (animalId: string): AnimalPhoto[] =>
      photos.map(
        (item) =>
          item.original ??
          new AnimalPhoto({
            animalId,
            localPath: item.uri,
          })
      ),
    [photos]
  );

  return {
    photos,
    name,
    setName,
    species,
    setSpecies,
    sex,
    setSex,
    size,
    setSize,
    approximateAge,
    setApproximateAge,
    behavior,
    setBehavior,
    specialCare,
    setSpecialCare,
    neighborhood,
    setNeighborhood,
    city,
    setCity,
    latitude,
    longitude,
    locGeocoded,
    locating,
    saving,
    setSaving,
    hydrateFromAnimal,
    handleCaptureCamera,
    handlePickGallery,
    removePhotoAt,
    handleUseMyLocation,
    buildValueObjects,
    toDomainPhotos,
  };
}
