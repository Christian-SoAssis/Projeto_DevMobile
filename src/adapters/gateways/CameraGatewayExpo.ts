import { CameraGateway, CameraPhotoResult } from '../../domain/ports/CameraGateway';

export class CameraGatewayExpo implements CameraGateway {
  async capturePhoto(): Promise<CameraPhotoResult | null> {
    return {
      uri: 'file://expo_camera_captured_photo.jpg',
      width: 1024,
      height: 768,
    };
  }

  async pickImageFromGallery(): Promise<CameraPhotoResult | null> {
    return {
      uri: 'file://expo_gallery_picked_photo.jpg',
      width: 1024,
      height: 768,
    };
  }
}
