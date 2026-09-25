import { LocationGateway } from '../../domain/ports/LocationGateway';
import { ApproximateLocation } from '../../domain/value-objects/ApproximateLocation';

export class LocationGatewayFake implements LocationGateway {
  public mockLocation: ApproximateLocation = new ApproximateLocation({
    latitude: -21.554,
    longitude: -45.435,
    neighborhood: 'Centro',
    city: 'Varginha',
    region: 'MG',
  });

  async getCurrentLocation(): Promise<ApproximateLocation> {
    return this.mockLocation;
  }
}
