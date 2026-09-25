import { CameraGatewayExpo } from '../../src/adapters/gateways/CameraGatewayExpo';

describe('CameraGatewayExpo Hardware Adapter', () => {
  it('deve retornar foto mockada ao capturar foto ou selecionar da galeria', async () => {
    const gateway = new CameraGatewayExpo();

    const photo = await gateway.capturePhoto();
    expect(photo?.uri).toContain('expo_camera_captured_photo.jpg');

    const galleryPhoto = await gateway.pickImageFromGallery();
    expect(galleryPhoto?.uri).toContain('expo_gallery_picked_photo.jpg');
  });
});
