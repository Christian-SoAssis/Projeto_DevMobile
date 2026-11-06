import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Animal } from '../../domain/entities/Animal';
import { newUuid } from '../../domain/services/IdGenerator';
import { AnimalPhoto } from '../../domain/entities/AnimalPhoto';
import { AnimalCharacteristics } from '../../domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../domain/value-objects/ApproximateLocation';
import { AnimalRepository } from '../../domain/ports/AnimalRepository';
import { SyncQueueRepository } from '../../domain/ports/SyncQueueRepository';
import { CameraGateway } from '../../domain/ports/CameraGateway';
import { LocationGateway } from '../../domain/ports/LocationGateway';
import { PhotoStorage } from '../../domain/ports/PhotoStorage';
import { CreateAnimalUseCase } from '../../application/use-cases/CreateAnimalUseCase';
import { UpdateAnimalUseCase } from '../../application/use-cases/UpdateAnimalUseCase';
import { CameraGatewayFake } from '../../application/fakes/CameraGatewayFake';
import { LocationGatewayFake } from '../../application/fakes/LocationGatewayFake';
import { PhotoStorageFake } from '../../application/fakes/PhotoStorageFake';
import { UnitOfWork } from '../../application/ports/UnitOfWork';
import { NoopUnitOfWork } from '../../application/fakes/NoopUnitOfWork';
import { AnimalPhotoView } from '../components/AnimalPhotoView';
import { MAX_PHOTOS_PER_ANIMAL } from '../../domain/entities/Animal';

export interface AnimalFormScreenProps {
  ownerId?: string;
  initialAnimal?: Animal;
  animalRepository: AnimalRepository;
  syncQueueRepository: SyncQueueRepository;
  cameraGateway?: CameraGateway;
  locationGateway?: LocationGateway;
  photoStorage?: PhotoStorage;
  unitOfWork?: UnitOfWork;
  onSuccess?: () => void;
  isOnline?: boolean;
}

interface PhotoDraft {
  /** URI (local da câmera/galeria ou destino persistido) para pré-visualização. */
  uri: string;
  /** Presente quando a foto já pertence ao anúncio (modo edição) — não é reenviada. */
  existingId?: string;
}

export const AnimalFormScreen: React.FC<AnimalFormScreenProps> = ({
  ownerId = 'usr_1',
  initialAnimal,
  animalRepository,
  syncQueueRepository,
  cameraGateway = new CameraGatewayFake(),
  locationGateway = new LocationGatewayFake(),
  photoStorage = new PhotoStorageFake(),
  unitOfWork = new NoopUnitOfWork(),
  onSuccess,
  isOnline = true,
}) => {
  const isEdit = !!initialAnimal;
  const [name, setName] = useState(initialAnimal?.name ?? '');
  const [species, setSpecies] = useState(initialAnimal?.characteristics.species ?? 'Cão');
  const [size, setSize] = useState(initialAnimal?.characteristics.size ?? 'Médio');
  const [approximateAge, setApproximateAge] = useState(initialAnimal?.characteristics.approximateAge ?? '2 anos');
  const [sex, setSex] = useState(initialAnimal?.characteristics.sex ?? 'Macho');
  const [city, setCity] = useState(initialAnimal?.location.city ?? 'Varginha');
  const [neighborhood, setNeighborhood] = useState(initialAnimal?.location.neighborhood ?? 'Centro');
  /**
   * RF09 + decisão de produto: o anúncio aceita até `MAX_PHOTOS_PER_ANIMAL`
   * (4) fotos. Em edição, a lista começa com as fotos atuais; novas capturas
   * são acrescentadas e a ordem/remoção é definida aqui antes de salvar.
   */
  const [photoList, setPhotoList] = useState<PhotoDraft[]>(
    (initialAnimal?.photos ?? []).map((p) => ({ uri: p.displayUrl, existingId: p.id }))
  );
  const [locationStatus, setLocationStatus] = useState<string>('Não capturada');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [latitude, setLatitude] = useState<number>(initialAnimal?.location.latitude ?? -21.554);
  const [longitude, setLongitude] = useState<number>(initialAnimal?.location.longitude ?? -45.435);

  const photosFull = photoList.length >= MAX_PHOTOS_PER_ANIMAL;

  const appendPhoto = async (photo: { uri: string } | null, origem: 'câmera' | 'galeria') => {
    if (!photo) {
      setFeedback(
        origem === 'câmera'
          ? 'Nenhuma foto capturada. Conceda a permissão da câmera ou salve o anúncio sem foto.'
          : 'Nenhuma foto selecionada. Conceda a permissão da galeria ou salve o anúncio sem foto.'
      );
      return;
    }
    if (photoList.length >= MAX_PHOTOS_PER_ANIMAL) {
      setFeedback(`Máximo de ${MAX_PHOTOS_PER_ANIMAL} fotos por anúncio (RF09).`);
      return;
    }
    setPhotoList((prev) => [...prev, { uri: photo.uri }]);
    setFeedback(origem === 'câmera' ? 'Foto capturada com sucesso!' : 'Foto escolhida da galeria!');
  };

  const handleCapturePhoto = async () => {
    const photo = await cameraGateway.capturePhoto();
    await appendPhoto(photo, 'câmera');
  };

  // RF09: a foto pode vir da câmera OU da galeria — mesmo fluxo de
  // persistência (WebP + cópia) e mesmo preview dos dois caminhos.
  const handlePickGallery = async () => {
    const photo = await cameraGateway.pickImageFromGallery();
    await appendPhoto(photo, 'galeria');
  };

  const handleRemovePhoto = async (index: number) => {
    const item = photoList[index];
    if (!item) return;
    setPhotoList((prev) => prev.filter((_, i) => i !== index));
    // Foto que já existia no anúncio: a cópia física sai do armazenamento
    // (best-effort) e o registro sai do agregado ao salvar a edição.
    if (initialAnimal && item.existingId) {
      try {
        await photoStorage.remove(item.existingId);
      } catch {
        // Falha na limpeza física não impede a edição do anúncio.
      }
    }
  };

  const handleMovePhoto = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= photoList.length) return;
    setPhotoList((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
  };

  const handleCaptureLocation = async () => {
    try {
      const loc = await locationGateway.getCurrentLocation();
      setLatitude(loc.latitude);
      setLongitude(loc.longitude);
      setCity(loc.city);
      setNeighborhood(loc.neighborhood);
      setLocationStatus(`Capturada: ${loc.neighborhood}, ${loc.city}`);
      setFeedback('Localização pontual capturada!');
    } catch (err: any) {
      // UC01-A3: permissão negada / GPS indisponível não quebra o formulário —
      // o local pode ser preenchido manualmente.
      setLatitude(initialAnimal?.location.latitude ?? -21.554);
      setLongitude(initialAnimal?.location.longitude ?? -45.435);
      setCity(initialAnimal?.location.city ?? 'Varginha');
      setNeighborhood(initialAnimal?.location.neighborhood ?? 'Centro');
      setLocationStatus('Não capturada');
      setFeedback(
        err?.name === 'LocationPermissionDeniedError' || err?.name === 'LocationUnavailableError'
          ? 'Geolocalização indisponível neste momento. Preencha bairro e cidade manualmente.'
          : `Falha ao capturar localização. ${err?.message || 'Tente novamente ou preencha manualmente.'}`
      );
    }
  };

  const handleSubmit = async () => {
    setFeedback(null);
    try {
      if (isEdit && initialAnimal) {
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

        const useCase = new UpdateAnimalUseCase(
          animalRepository,
          syncQueueRepository,
          unitOfWork
        );
        // Fotos novas são persistidas (e convertidas para WebP) ANTES de
        // entrar no agregado; fotos já existentes são reenvidadas/ordenadas
        // sem tocar no armazenamento. `photos` só é passado quando a lista
        // mudou — editar só o texto não regrava as fotos.
        const photosChanged =
          photoList.length !== initialAnimal.photos.length ||
          photoList.some((item, i) => item.uri !== initialAnimal.photos[i]?.displayUrl);
        let photos: AnimalPhoto[] | undefined;
        if (photosChanged) {
          photos = [];
          for (const item of photoList) {
            if (item.existingId) {
              const existing = initialAnimal.photos.find((p) => p.id === item.existingId);
              if (existing) {
                photos.push(existing);
                continue;
              }
            }
            const captured = new AnimalPhoto({
              id: newUuid(),
              animalId: initialAnimal.id,
              localPath: item.uri,
            });
            photos.push(await photoStorage.persistLocal(captured));
          }
        }
        await useCase.execute(
          ownerId,
          initialAnimal.id,
          { name, characteristics, location, photos },
          isOnline
        );
        setFeedback('Anúncio atualizado com sucesso!');
        if (onSuccess) onSuccess();
        return;
      }
      const animalId = newUuid();
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

      if (photoList.length > 0) {
        // Doc §5.1/§14.1: cada foto vai para o armazenamento seguro (cópia
        // física + registro em `local_images`) ANTES de anexar; a foto no
        // agregado leva o destino definitivo — a URI temporária da câmera
        // morre quando o app é encerrado (RNF01/RNF02), o arquivo copiado não.
        for (const item of photoList) {
          const captured = new AnimalPhoto({
            id: newUuid(),
            animalId,
            localPath: item.uri,
          });
          animal.addPhoto(await photoStorage.persistLocal(captured));
        }
      }

      const useCase = new CreateAnimalUseCase(
        animalRepository,
        syncQueueRepository,
        unitOfWork
      );
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
      <Text style={styles.formTitle} testID="form-title">{isEdit ? 'Editar Anúncio' : 'Cadastrar Novo Animal'}</Text>

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

      <Text style={styles.label}>Sexo *</Text>
      <View style={styles.radioGroup}>
        {['Macho', 'Fêmea'].map((sx) => (
          <TouchableOpacity
            key={sx}
            style={[styles.radio, sex === sx && styles.radioActive]}
            onPress={() => setSex(sx)}
            testID={`radio-sex-${sx}`}
          >
            <Text style={[styles.radioText, sex === sx && styles.radioTextActive]}>{sx}</Text>
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

      {/* Camera & Gallery Triggers */}
      <View style={styles.hardwareSection}>
        <View style={styles.hwBtnRow}>
          <TouchableOpacity style={styles.hwBtn} onPress={handleCapturePhoto} testID="btn-capture-photo">
            <Text style={styles.hwBtnText}>📷 Câmera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.hwBtn} onPress={handlePickGallery} testID="btn-pick-gallery">
            <Text style={styles.hwBtnText}>🖼️ Galeria</Text>
          </TouchableOpacity>
        </View>

        {/* Pré-visualização (RF09, limite de 4 fotos): em edição, começa com as
            fotos atuais do anúncio; novas fotos entram no fim da lista e a
            ordem/remoção são definidas antes de salvar. */}
        {(photoList.length > 0 ? photoList : [null]).map((item, index) =>
          item ? (
            <View key={`${item.uri}-${index}`} style={styles.photoItem}>
              <AnimalPhotoView
                uri={item.uri}
                photo={null}
                testID={index === 0 ? 'form-photo-preview' : `form-photo-preview-${index + 1}`}
                style={styles.photoThumb}
              />
              {photoList.length > 1 && (
                <View style={styles.photoNavRow}>
                  <TouchableOpacity
                    style={styles.photoNavBtn}
                    onPress={() => handleMovePhoto(index, -1)}
                    disabled={index === 0}
                    testID={`btn-photo-left-${index}`}
                  >
                    <Text style={styles.photoNavText}>◀</Text>
                  </TouchableOpacity>
                  <Text style={styles.photoIndex} testID={`photo-index-${index}`}>
                    {index + 1}
                  </Text>
                  <TouchableOpacity
                    style={styles.photoNavBtn}
                    onPress={() => handleMovePhoto(index, 1)}
                    disabled={index === photoList.length - 1}
                    testID={`btn-photo-right-${index}`}
                  >
                    <Text style={styles.photoNavText}>▶</Text>
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity
                style={styles.removePhotoBtn}
                onPress={() => handleRemovePhoto(index)}
                testID={`btn-remove-photo-${index}`}
              >
                <Text style={styles.removePhotoText}>✕ Remover foto</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <AnimalPhotoView
              key="placeholder"
              uri={undefined}
              photo={null}
              testID="form-photo-preview"
              style={styles.photoPreview}
            />
          )
        )}

        <Text
          style={[styles.photoCounter, photosFull && styles.photoCounterMax]}
          testID="photo-count"
        >
          {photoList.length}/{MAX_PHOTOS_PER_ANIMAL} fotos
        </Text>
        {photoList.length > 0 && (
          <Text style={styles.hwStatus} testID="photo-status">
            {photoList.length > 1
              ? `${photoList.length} fotos atreladas ao anúncio (máx. ${MAX_PHOTOS_PER_ANIMAL}).`
              : 'Foto atrelada ao anúncio (máx. 4).'}
          </Text>
        )}

        <TouchableOpacity style={[styles.hwBtn, styles.hwBtnWide]} onPress={handleCaptureLocation} testID="btn-capture-location">
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
    flex: 1,
    backgroundColor: '#6c757d',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  hwBtnWide: {
    flex: 0,
  },
  hwBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  hwBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  photoPreview: {
    height: 170,
    marginBottom: 10,
  },
  photoItem: {
    marginBottom: 10,
  },
  photoThumb: {
    height: 130,
    marginBottom: 6,
  },
  photoNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  photoNavBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#e5e5ea',
  },
  photoNavText: {
    color: '#1c1c1e',
    fontWeight: 'bold',
  },
  photoIndex: {
    color: '#666',
    fontWeight: 'bold',
  },
  removePhotoBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#ffe5e3',
    marginBottom: 4,
  },
  removePhotoText: {
    color: '#a30000',
    fontWeight: 'bold',
    fontSize: 12,
  },
  photoCounter: {
    fontSize: 12,
    color: '#555',
    marginBottom: 8,
  },
  photoCounterMax: {
    color: '#a30000',
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
