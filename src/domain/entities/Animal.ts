import { AdoptionStatus } from '../value-objects/AdoptionStatus';
import { ApproximateLocation } from '../value-objects/ApproximateLocation';
import { AnimalCharacteristics } from '../value-objects/AnimalCharacteristics';
import { AnimalPhoto } from './AnimalPhoto';

export interface AnimalProps {
  id: string;
  ownerId: string;
  name: string;
  characteristics: AnimalCharacteristics;
  status?: AdoptionStatus;
  location: ApproximateLocation;
  photos?: AnimalPhoto[];
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}

export class Animal {
  readonly id: string;
  readonly ownerId: string;
  private _name: string;
  private _characteristics: AnimalCharacteristics;
  private _status: AdoptionStatus;
  private _location: ApproximateLocation;
  private _photos: AnimalPhoto[];
  readonly createdAt: string;
  private _updatedAt: string;
  private _version: number;

  constructor(props: AnimalProps) {
    if (!props.id) throw new Error('ID do animal é obrigatório.');
    if (!props.ownerId) throw new Error('ID do proprietário é obrigatório.');
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Nome do animal é obrigatório.');
    }
    if (!props.location) throw new Error('Localização aproximada é obrigatória.');

    this.id = props.id;
    this.ownerId = props.ownerId;
    this._name = props.name.trim();
    this._characteristics = props.characteristics;
    this._status = props.status || AdoptionStatus.available();
    this._location = props.location;
    this._photos = props.photos || [];
    this.createdAt = props.createdAt || new Date().toISOString();
    this._updatedAt = props.updatedAt || this.createdAt;
    this._version = props.version || 1;
  }

  get name(): string {
    return this._name;
  }

  get characteristics(): AnimalCharacteristics {
    return this._characteristics;
  }

  get status(): AdoptionStatus {
    return this._status;
  }

  get location(): ApproximateLocation {
    return this._location;
  }

  get photos(): readonly AnimalPhoto[] {
    return this._photos;
  }

  get updatedAt(): string {
    return this._updatedAt;
  }

  get version(): number {
    return this._version;
  }

  isOwner(userId: string): boolean {
    return this.ownerId === userId;
  }

  markAdopted(requestorId: string): void {
    if (!this.isOwner(requestorId)) {
      throw new Error('Somente o responsável pelo anúncio pode marcar o animal como adotado.');
    }
    if (this._status.isAdopted()) {
      throw new Error('Este animal já está marcado como adotado.');
    }
    this._status = AdoptionStatus.adopted();
    this.touch();
  }

  updateData(
    requestorId: string,
    updates: {
      name?: string;
      characteristics?: AnimalCharacteristics;
      location?: ApproximateLocation;
    }
  ): void {
    if (!this.isOwner(requestorId)) {
      throw new Error('Somente o responsável pelo anúncio pode alterar seus dados.');
    }
    if (updates.name && updates.name.trim().length > 0) {
      this._name = updates.name.trim();
    }
    if (updates.characteristics) {
      this._characteristics = updates.characteristics;
    }
    if (updates.location) {
      this._location = updates.location;
    }
    this.touch();
  }

  addPhoto(photo: AnimalPhoto): void {
    if (photo.animalId !== this.id) {
      throw new Error('Foto não pertence a este animal.');
    }
    this._photos.push(photo);
    this.touch();
  }

  removePhoto(photoId: string, requestorId: string): void {
    if (!this.isOwner(requestorId)) {
      throw new Error('Somente o responsável pode remover fotos.');
    }
    this._photos = this._photos.filter((p) => p.id !== photoId);
    this.touch();
  }

  canGeneratePdf(): boolean {
    return !!this.name && !!this.characteristics.species && this._photos.length > 0;
  }

  private touch(): void {
    this._version += 1;
    this._updatedAt = new Date().toISOString();
  }
}
