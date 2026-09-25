import { CameraGateway, CameraPhotoResult } from '../../domain/ports/CameraGateway';

export class CameraGatewayFake implements CameraGateway {
  public mockPhoto: CameraPhotoResult = {
    uri: 'file://fake_photo_captured.jpg',
    base64: 'data:image/jpeg;base64,fakebase64data',
    width: 800,
    height: 600,
  };

  async capturePhoto(): Promise<CameraPhotoResult | null> {
    return this.mockPhoto;
  }

  async pickImageFromGallery(): Promise<CameraPhotoResult | null> {
    return this.mockPhoto;
  }
}
