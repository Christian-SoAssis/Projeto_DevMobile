import { CameraGateway, CameraPhotoResult } from '../../../domain/ports/CameraGateway';

/**
 * Forma mínima do módulo `expo-image-picker`. O módulo é carregado
 * dinamicamente (não via import estático) para que os testes rodem mesmo
 * sem a ponte nativa — mesmo padrão do `NetInfoConnectivityAdapter`.
 */
interface PermissionResult {
  granted: boolean;
}

interface PickResult {
  canceled?: boolean;
  assets?: Array<{
    uri?: string;
    width?: number;
    height?: number;
  }>;
}

export interface ImagePickerModule {
  requestCameraPermissionsAsync(): Promise<PermissionResult>;
  /**
   * `ImagePicker.launchCameraAsync` — `quality` numérica entre 0 e 1.
   */
  launchCameraAsync(options?: { quality?: number; allowsEditing?: boolean }): Promise<PickResult>;
  /**
   * `ImagePicker.pickImageAsync` — a própria API trata a permissão da
   * biblioteca de mídia e o cancelamento do usuário.
   */
  pickImageAsync(options?: { quality?: number; allowsMultipleSelection?: boolean }): Promise<PickResult>;
}

export interface ImagePickerCameraAdapterOptions {
  /** Módulo injetado (testes). `null` força o caminho "sem módulo". */
  imagePickerModule?: ImagePickerModule | null;
  /** Qualidade de compressão (0–1) aplicada às duas fontes de imagem. */
  quality?: number;
}

/**
 * Adapter de hardware real para foto de anúncio (RF09, RF26).
 *
 * Decisão técnica: `expo-image-picker` cobre **câmera e galeria** em um
 * único módulo — por isso substitui o `expo-camera` isolado. O port
 * `CameraGateway` do domínio não muda; quem muda é a implementação.
 *
 * Contrato de falha (doc §16.3 Dispositivo): câmera negada **não lança
 * erro** — devolve `null` e a UI orienta o uso da galeria (a própria
 * galeria também devolve `null` quando o usuário cancela).
 */
export class ImagePickerCameraAdapter implements CameraGateway {
  private imagePicker: ImagePickerModule | null;
  private quality: number;

  constructor(options: ImagePickerCameraAdapterOptions = {}) {
    this.quality = options.quality ?? 0.7;

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
    if (!this.imagePicker) {
      return null;
    }
    try {
      const permission = await this.imagePicker.requestCameraPermissionsAsync();
      if (!permission || permission.granted !== true) {
        return null;
      }
      const result = await this.imagePicker.launchCameraAsync({ quality: this.quality });
      return this.toPhotoResult(result);
    } catch {
      return null;
    }
  }

  async pickImageFromGallery(): Promise<CameraPhotoResult | null> {
    if (!this.imagePicker) {
      return null;
    }
    try {
      const result = await this.imagePicker.pickImageAsync({ quality: this.quality });
      return this.toPhotoResult(result);
    } catch {
      return null;
    }
  }

  private toPhotoResult(result: PickResult | undefined): CameraPhotoResult | null {
    if (!result || result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }
    const asset = result.assets[0];
    if (!asset?.uri) {
      return null;
    }
    return {
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
    };
  }
}
