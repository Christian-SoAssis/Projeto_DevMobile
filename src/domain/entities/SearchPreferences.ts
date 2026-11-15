import { SearchRadius } from '../value-objects/SearchRadius';

export interface SearchPreferencesProps {
  species?: string;
  size?: string;
  approximateAge?: string;
  sex?: string;
  distanceKm?: number;
  region?: string;
}

export class SearchPreferences {
  public readonly species?: string;
  public readonly size?: string;
  public readonly approximateAge?: string;
  public readonly sex?: string;
  public readonly distanceKm?: number;
  public readonly region?: string;

  constructor(props: SearchPreferencesProps = {}) {
    if (props.distanceKm !== undefined) {
      new SearchRadius(props.distanceKm);
    }
    this.species = props.species?.trim() || undefined;
    this.size = props.size?.trim() || undefined;
    this.approximateAge = props.approximateAge?.trim() || undefined;
    this.sex = props.sex?.trim() || undefined;
    this.distanceKm = props.distanceKm;
    this.region = props.region?.trim() || undefined;
  }
}
