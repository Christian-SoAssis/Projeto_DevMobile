import { AdoptionStatus } from '../value-objects/AdoptionStatus';
import { AnimalCharacteristics } from '../value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../value-objects/ApproximateLocation';
import { AnimalPhoto } from './AnimalPhoto';
import { generateUuid } from '../services/IdGenerator';

/** Decisão 13 (RF09): limite máximo de 4 fotos por anúncio. */
export const MAX_PHOTOS_PER_ANIMAL = 4;

export interface AnimalProps {
  id?: string;
  ownerId: string;
  name: string;
  characteristics: AnimalCharacteristics;
  location: ApproximateLocation;
  status?: AdoptionStatus;
  photos?: AnimalPhoto[];
  hidden?: boolean;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Raiz de Agregado principal do sistema (§12.2).
 * Governa fotos, localização aproximada, status de adoção e controle de versão (RNF03).
 */
export class Animal {
  public readonly id: string;
  public readonly ownerId: string;
  private _name: string;
  private _characteristics: AnimalCharacteristics;
  private _location: ApproximateLocation;
  private _status: AdoptionStatus;
  private _photos: AnimalPhoto[];
  private _hidden: boolean;
  private _version: number;
  public readonly createdAt: string;
  private _updatedAt: string;

  constructor(props: AnimalProps) {
    const trimmedName = (props.name ?? '').trim();
    if (!trimmedName) {
      throw new Error('O nome do animal é obrigatório.');
    }
    if (trimmedName.length < 2 || trimmedName.length > 60) {
      throw new Error('O nome do animal deve ter entre 2 e 60 caracteres.');
    }
    if (!props.ownerId || !props.ownerId.trim()) {
      throw new Error('O responsável pelo anúncio é obrigatório.');
    }
    const photos = props.photos ?? [];
    if (photos.length > MAX_PHOTOS_PER_ANIMAL) {
      throw new Error(`O anúncio pode ter no máximo ${MAX_PHOTOS_PER_ANIMAL} fotos.`);
    }

    this.id = props.id ?? generateUuid();
    this.ownerId = props.ownerId.trim();
    this._name = trimmedName;
    this._characteristics = props.characteristics;
    this._location = props.location;
    this._status = props.status ?? AdoptionStatus.available();
    this._photos = [...photos];
    this._hidden = props.hidden ?? false;
    this._version = props.version ?? 1;
    const now = new Date().toISOString();
    this.createdAt = props.createdAt ?? now;
    this._updatedAt = props.updatedAt ?? now;
  }

  get name(): string {
    return this._name;
  }

  get characteristics(): AnimalCharacteristics {
    return this._characteristics;
  }

  get location(): ApproximateLocation {
    return this._location;
  }

  get status(): AdoptionStatus {
    return this._status;
  }

  get photos(): AnimalPhoto[] {
    return [...this._photos];
  }

  get hidden(): boolean {
    return this._hidden;
  }

  get version(): number {
    return this._version;
  }

  get updatedAt(): string {
    return this._updatedAt;
  }

  addPhoto(photo: AnimalPhoto): void {
    if (this._photos.length >= MAX_PHOTOS_PER_ANIMAL) {
      throw new Error(`O anúncio pode ter no máximo ${MAX_PHOTOS_PER_ANIMAL} fotos.`);
    }
    this._photos.push(photo);
    this.bumpVersion();
  }

  setPhotos(photos: AnimalPhoto[]): void {
    if (photos.length > MAX_PHOTOS_PER_ANIMAL) {
      throw new Error(`O anúncio pode ter no máximo ${MAX_PHOTOS_PER_ANIMAL} fotos.`);
    }
    this._photos = [...photos];
  }

  markAdopted(actorUserId: string): void {
    if (actorUserId !== this.ownerId) {
      throw new Error('Somente o responsável pode marcar o animal como adotado.');
    }
    if (this._status.isAdopted()) {
      throw new Error('O animal já está marcado como adotado.');
    }
    this._status = AdoptionStatus.adopted();
    this.bumpVersion();
  }

  /** Decisão D4: Permite ao responsável reabrir um anúncio de "Adotado" para "Disponível". */
  reopenAdoption(actorUserId: string): void {
    if (actorUserId !== this.ownerId) {
      throw new Error('Somente o responsável pode reabrir o anúncio para adoção.');
    }
    if (this._status.isAvailable()) {
      throw new Error('O animal já está disponível para adoção.');
    }
    this._status = AdoptionStatus.available();
    this.bumpVersion();
  }

  updateData(
    actorUserId: string,
    updates: {
      name?: string;
      characteristics?: AnimalCharacteristics;
      location?: ApproximateLocation;
      photos?: AnimalPhoto[];
    }
  ): void {
    if (actorUserId !== this.ownerId) {
      throw new Error('Somente o responsável pode editar este anúncio.');
    }
    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      if (!trimmed) throw new Error('O nome do animal é obrigatório.');
      if (trimmed.length < 2 || trimmed.length > 60) {
        throw new Error('O nome do animal deve ter entre 2 e 60 caracteres.');
      }
      this._name = trimmed;
    }
    if (updates.characteristics) {
      this._characteristics = updates.characteristics;
    }
    if (updates.location) {
      this._location = updates.location;
    }
    if (updates.photos) {
      if (updates.photos.length > MAX_PHOTOS_PER_ANIMAL) {
        throw new Error(`O anúncio pode ter no máximo ${MAX_PHOTOS_PER_ANIMAL} fotos.`);
      }
      this._photos = [...updates.photos];
    }
    this.bumpVersion();
  }

  setHidden(hidden: boolean): void {
    this._hidden = hidden;
    this.bumpVersion();
  }

  private bumpVersion(): void {
    this._version += 1;
    this._updatedAt = new Date().toISOString();
  }
}
