import { CameraGateway, CameraPhotoResult } from '../../../domain/ports/CameraGateway';

export interface ImagePickerCameraAdapterOptions {
  imagePickerModule?: any | null;
  quality?: number;
}

/**
 * Adapter de câmera e galeria via `expo-image-picker` (PER-01 a PER-06, RF09).
 */
export class ImagePickerCameraAdapter implements CameraGateway {
  private imagePicker: any | null;
  private quality: number;

  constructor(options: ImagePickerCameraAdapterOptions = {}) {
    this.quality = options.quality ?? 0.75;

    if ('imagePickerModule' in options) {
      this.imagePicker = options.imagePickerModule || null;
    } else {
      try {
        this.imagePicker = require('expo-image-picker');
      } catch {
        this.imagePicker = null;
      }
    }
  }

  async capturePhoto(): Promise<CameraPhotoResult | null> {
    if (!this.imagePicker) return null;
    try {
      const perm = await this.imagePicker.requestCameraPermissionsAsync();
      if (!perm?.granted) return null;
      const result = await this.imagePicker.launchCameraAsync({
        quality: this.quality,
      });
      return this.extractAsset(result);
    } catch {
      return null;
    }
  }

  async pickImageFromGallery(): Promise<CameraPhotoResult | null> {
    if (!this.imagePicker) return null;
    try {
      const result = await this.imagePicker.launchImageLibraryAsync({
        quality: this.quality,
      });
      return this.extractAsset(result);
    } catch {
      return null;
    }
  }

  private extractAsset(result: any): CameraPhotoResult | null {
    if (!result || result.canceled || !Array.isArray(result.assets) || result.assets.length === 0) {
      return null;
    }
    const asset = result.assets[0];
    if (!asset?.uri) return null;
    return {
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
    };
  }
}
