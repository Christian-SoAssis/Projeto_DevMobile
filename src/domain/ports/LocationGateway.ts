import { ApproximateLocation } from '../value-objects/ApproximateLocation';

export interface LocationGateway {
  getCurrentLocation(): Promise<ApproximateLocation>;
}
