export interface SearchPreferencesProps {
  species?: string;
  size?: string;
  age?: string;
  sex?: string;
  distance?: number;
  region?: string;
}

export class SearchPreferences {
  readonly species?: string;
  readonly size?: string;
  readonly age?: string;
  readonly sex?: string;
  readonly distance?: number;
  readonly region?: string;

  constructor(props: SearchPreferencesProps = {}) {
    this.species = props.species?.trim() || undefined;
    this.size = props.size?.trim() || undefined;
    this.age = props.age?.trim() || undefined;
    this.sex = props.sex?.trim() || undefined;
    this.distance = props.distance;
    this.region = props.region?.trim() || undefined;
  }

  isEmpty(): boolean {
    return (
      this.species === undefined &&
      this.size === undefined &&
      this.age === undefined &&
      this.sex === undefined &&
      this.distance === undefined &&
      this.region === undefined
    );
  }
}
