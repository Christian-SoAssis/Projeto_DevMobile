import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Animal } from '../../domain/entities/Animal';
import { AnimalPhoto } from '../../domain/entities/AnimalPhoto';
import { AnimalCharacteristics } from '../../domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../domain/value-objects/ApproximateLocation';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { CameraGateway } from '../../domain/ports/CameraGateway';
import { LocationGateway } from '../../domain/ports/LocationGateway';
import { CreateAnimalUseCase } from '../../application/use-cases/CreateAnimalUseCase';
import { CameraGatewayFake } from '../../application/fakes/CameraGatewayFake';
import { LocationGatewayFake } from '../../application/fakes/LocationGatewayFake';

export interface AnimalFormScreenProps {
  ownerId?: string;
  animalRepository: AnimalRepository;
  syncQueueRepository: SyncQueueRepository;
  cameraGateway?: CameraGateway;
  locationGateway?: LocationGateway;
  onSuccess?: () => void;
  isOnline?: boolean;
}

export const AnimalFormScreen: React.FC<AnimalFormScreenProps> = ({
  ownerId = 'usr_1',
  animalRepository,
  syncQueueRepository,
  cameraGateway = new CameraGatewayFake(),
  locationGateway = new LocationGatewayFake(),
  onSuccess,
  isOnline = true,
}) => {
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('Cão');
  const [size, setSize] = useState('Médio');
  const [approximateAge, setApproximateAge] = useState('2 anos');
  const [sex, setSex] = useState('Macho');
  const [city, setCity] = useState('Varginha');
  const [neighborhood, setNeighborhood] = useState('Centro');
  const [capturedPhotoUri, setCapturedPhotoUri] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<string>('Não capturada');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number>(-21.554);
  const [longitude, setLongitude] = useState<number>(-45.435);

  const handleCapturePhoto = async () => {
    const photo = await cameraGateway.capturePhoto();
    if (photo) {
      setCapturedPhotoUri(photo.uri);
      setFeedback('Foto capturada com sucesso!');
    }
  };

  const handleCaptureLocation = async () => {
    const loc = await locationGateway.getCurrentLocation();
    setLatitude(loc.latitude);
    setLongitude(loc.longitude);
    setCity(loc.city);
    setNeighborhood(loc.neighborhood);
    setLocationStatus(`Capturada: ${loc.neighborhood}, ${loc.city}`);
    setFeedback('Localização pontual capturada!');
  };

  const handleSubmit = async () => {
    setFeedback(null);
    try {
      const animalId = `anim_${Date.now()}`;
      const location = new ApproximateLocation({
        latitude,
        longitude,
        city,
        neighborhood,
        region: 'MG',
      });
      const characteristics = new AnimalCharacteristics({
        species,
        size,
        approximateAge,
        sex,
      });

      const animal = new Animal({
        id: animalId,
        ownerId,
        name,
        characteristics,
        location,
      });

      if (capturedPhotoUri) {
        animal.addPhoto(
          new AnimalPhoto({
            id: `photo_${Date.now()}`,
            animalId,
            localPath: capturedPhotoUri,
          })
        );
      }

      const useCase = new CreateAnimalUseCase(animalRepository, syncQueueRepository);
      const result = await useCase.execute(animal, isOnline);

      if (result.synced) {
        setFeedback('Anúncio cadastrado e sincronizado remotamente!');
      } else {
        setFeedback('Anúncio salvo localmente. Fila de sincronização registrada para quando houver internet.');
      }

      if (onSuccess) onSuccess();
    } catch (err: any) {
      setFeedback(err.message || 'Erro ao cadastrar animal.');
    }
  };

  return (
    <ScrollView style={styles.container} testID="animal-form-screen">
      <Text style={styles.formTitle}>Cadastrar Novo Animal</Text>

      {feedback && (
        <View style={styles.feedbackBanner} testID="form-feedback">
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>
      )}

      <Text style={styles.label}>Nome do Animal *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex.: Luna"
        value={name}
        onChangeText={setName}
        testID="input-name"
      />

      <Text style={styles.label}>Espécie *</Text>
      <View style={styles.radioGroup}>
        {['Cão', 'Gato'].map((sp) => (
          <TouchableOpacity
            key={sp}
            style={[styles.radio, species === sp && styles.radioActive]}
            onPress={() => setSpecies(sp)}
            testID={`radio-species-${sp}`}
          >
            <Text style={[styles.radioText, species === sp && styles.radioTextActive]}>{sp}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Porte *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex.: Pequeno, Médio, Grande"
        value={size}
        onChangeText={setSize}
        testID="input-size"
      />

      <Text style={styles.label}>Idade Aproximada *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex.: 1 ano"
        value={approximateAge}
        onChangeText={setApproximateAge}
        testID="input-age"
      />

      <Text style={styles.label}>Bairro / Cidade *</Text>
      <TextInput
        style={styles.input}
        placeholder="Bairro"
        value={neighborhood}
        onChangeText={setNeighborhood}
        testID="input-neighborhood"
      />
      <TextInput
        style={styles.input}
        placeholder="Cidade"
        value={city}
        onChangeText={setCity}
        testID="input-city"
      />

      {/* Camera & Location Triggers */}
      <View style={styles.hardwareSection}>
        <TouchableOpacity style={styles.hwBtn} onPress={handleCapturePhoto} testID="btn-capture-photo">
          <Text style={styles.hwBtnText}>📷 Capturar Foto (Câmera)</Text>
        </TouchableOpacity>
        {capturedPhotoUri && (
          <Text style={styles.hwStatus} testID="photo-status">
            Foto capturada: {capturedPhotoUri}
          </Text>
        )}

        <TouchableOpacity style={styles.hwBtn} onPress={handleCaptureLocation} testID="btn-capture-location">
          <Text style={styles.hwBtnText}>📍 Obter Geolocalização</Text>
        </TouchableOpacity>
        <Text style={styles.hwStatus} testID="location-status">
          Localização: {locationStatus}
        </Text>
      </View>

      <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} testID="btn-submit-animal">
        <Text style={styles.submitText}>Salvar Anúncio</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#fff',
    padding: 16,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1c1c1e',
  },
  feedbackBanner: {
    backgroundColor: '#fff3cd',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
  },
  feedbackText: {
    color: '#856404',
    fontWeight: 'bold',
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    height: 44,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    backgroundColor: '#fafafa',
    marginBottom: 8,
  },
  radioGroup: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  radio: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#e5e5ea',
    marginRight: 8,
  },
  radioActive: {
    backgroundColor: '#0066cc',
  },
  radioText: {
    color: '#333',
  },
  radioTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  hardwareSection: {
    marginVertical: 16,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  hwBtn: {
    backgroundColor: '#6c757d',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 6,
  },
  hwBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  hwStatus: {
    fontSize: 12,
    color: '#28a745',
    marginBottom: 10,
  },
  submitBtn: {
    backgroundColor: '#28a745',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 32,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
