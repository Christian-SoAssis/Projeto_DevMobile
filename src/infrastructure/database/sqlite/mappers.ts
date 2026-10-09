import { AdoptionStatus } from '../../../domain/value-objects/AdoptionStatus';
import { AnimalCharacteristics } from '../../../domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../../domain/value-objects/ApproximateLocation';
import { ContactInfo } from '../../../domain/value-objects/ContactInfo';
import { SearchPreferences } from '../../../domain/value-objects/SearchPreferences';
import { SyncState } from '../../../domain/value-objects/SyncState';
import { AdoptionInterest } from '../../../domain/entities/AdoptionInterest';
import { Animal } from '../../../domain/entities/Animal';
import { AnimalPhoto } from '../../../domain/entities/AnimalPhoto';
import { Favorite } from '../../../domain/entities/Favorite';
import { SyncAction } from '../../../domain/entities/SyncAction';
import type {
  AdoptionInterestRow,
  AnimalPhotoRow,
  AnimalRow,
  FavoriteRow,
  ProfileRow,
  SearchPreferencesRow,
  SyncQueueRow,
} from './schema';

// Conversões puras linha ↔ entidade. Validação do domínio é preservada
// (construtores lançam em dados inválidos — corrupção de cache nunca entra
// silenciosa). Usado pelos repositórios e pela unidade de trabalho.

export function animalToRow(animal: Animal): AnimalRow {
  return {
    id: animal.id,
    ownerId: animal.ownerId,
    name: animal.name,
    species: animal.characteristics.species,
    size: animal.characteristics.size,
    approximateAge: animal.characteristics.approximateAge,
    sex: animal.characteristics.sex,
    characteristics: animal.characteristics.characteristics,
    behavior: animal.characteristics.behavior,
    specialCare: animal.characteristics.specialCare,
    adoptionStatus: animal.status.value,
    neighborhood: animal.location.neighborhood,
    city: animal.location.city,
    region: animal.location.region,
    latitudeApprox: animal.location.latitude,
    longitudeApprox: animal.location.longitude,
    createdAt: animal.createdAt,
    updatedAt: animal.updatedAt,
    version: animal.version,
  };
}

export function photoToRow(photo: AnimalPhoto, sortOrder: number): AnimalPhotoRow {
  return {
    id: photo.id,
    animalId: photo.animalId,
    storagePath: photo.localPath ?? null,
    remoteUrl: photo.remoteUrl ?? null,
    sortOrder,
    createdAt: photo.createdAt,
  };
}

export function rowToPhoto(row: AnimalPhotoRow): AnimalPhoto {
  return new AnimalPhoto({
    id: row.id,
    animalId: row.animalId,
    localPath: row.storagePath ?? undefined,
    remoteUrl: row.remoteUrl ?? undefined,
    createdAt: row.createdAt,
  });
}

export function rowToAnimal(row: AnimalRow, photos: AnimalPhoto[]): Animal {
  return new Animal({
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    characteristics: new AnimalCharacteristics({
      species: row.species,
      size: row.size,
      approximateAge: row.approximateAge,
      sex: row.sex,
      characteristics: row.characteristics,
      behavior: row.behavior,
      specialCare: row.specialCare,
    }),
    status: new AdoptionStatus(row.adoptionStatus as 'AVAILABLE' | 'ADOPTED'),
    location: new ApproximateLocation({
      latitude: row.latitudeApprox,
      longitude: row.longitudeApprox,
      neighborhood: row.neighborhood,
      city: row.city,
      region: row.region,
    }),
    photos,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: row.version,
  });
}

export function actionToRow(action: SyncAction): SyncQueueRow {
  return {
    id: action.id,
    operation: action.operation,
    entityType: action.entityType,
    entityId: action.entityId,
    payloadJson: JSON.stringify(action.payload),
    changedAt: action.changedAt,
    attempts: action.attempts,
    status: action.status.value,
    lastError: action.lastError ?? null,
  };
}

export function rowToAction(row: SyncQueueRow): SyncAction {
  return new SyncAction({
    id: row.id,
    operation: row.operation as SyncAction['operation'],
    entityType: row.entityType as SyncAction['entityType'],
    entityId: row.entityId,
    payload: JSON.parse(row.payloadJson) as Record<string, unknown>,
    changedAt: row.changedAt,
    attempts: row.attempts,
    status: new SyncState(row.status as SyncState['value']),
    lastError: row.lastError ?? undefined,
  });
}

export function favoriteToRow(favorite: Favorite): FavoriteRow {
  return { userId: favorite.userId, animalId: favorite.animalId, createdAt: favorite.createdAt };
}

export function rowToFavorite(row: FavoriteRow): Favorite {
  return new Favorite(row.userId, row.animalId, row.createdAt);
}

export function interestToRow(interest: AdoptionInterest): AdoptionInterestRow {
  return {
    id: interest.id,
    userId: interest.userId,
    animalId: interest.animalId,
    createdAt: interest.createdAt,
  };
}

export function rowToInterest(row: AdoptionInterestRow): AdoptionInterest {
  return new AdoptionInterest(row.id, row.userId, row.animalId, row.createdAt);
}

export function userToRow(user: { id: string; name: string; contactInfo: ContactInfo; role: string }): ProfileRow {
  return {
    id: user.id,
    name: user.name,
    email: user.contactInfo.email,
    phone: user.contactInfo.phone ?? null,
    role: user.role,
    createdAt: new Date().toISOString(),
  };
}

export function rowToUser(row: ProfileRow): { id: string; name: string; contactInfo: ContactInfo; role: ProfileRow['role'] } {
  return {
    id: row.id,
    name: row.name,
    contactInfo: new ContactInfo(row.email, row.phone ?? undefined),
    role: row.role,
  };
}

export function prefsToRow(userId: string, prefs: SearchPreferences): SearchPreferencesRow {
  return {
    userId,
    species: prefs.species ?? null,
    size: prefs.size ?? null,
    age: prefs.age ?? null,
    sex: prefs.sex ?? null,
    distance: prefs.distance ?? null,
    region: prefs.region ?? null,
  };
}

export function rowToPrefs(row: SearchPreferencesRow): SearchPreferences {
  return new SearchPreferences({
    species: row.species ?? undefined,
    size: row.size ?? undefined,
    age: row.age ?? undefined,
    sex: row.sex ?? undefined,
    distance: row.distance ?? undefined,
    region: row.region ?? undefined,
  });
}
