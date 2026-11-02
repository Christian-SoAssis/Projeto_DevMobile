import { Image } from 'react-native';
import { ImageConversionError, ImageProcessor } from '../../../domain/ports/ImageProcessor';

/** Maior lado da foto após a conversão (suficiente para tela de celular). */
export const MAX_IMAGE_SIDE = 1280;
/** Qualidade WebP: ~25–35% menor que JPEG sem perda perceptível. */
export const WEBP_QUALITY = 0.8;

/** Reduz para caber em `max` mantendo a proporção; nunca amplia. */
export function fitWithin(
  width: number,
  height: number,
  max: number = MAX_IMAGE_SIDE
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

interface ManipulatorModule {
  manipulateAsync(
    uri: string,
    actions: Array<{ resize: { width?: number; height?: number } }>,
    options: { compress: number; format: string }
  ): Promise<{ uri: string }>;
  SaveFormat: { WEBP: string };
}

type SizeReader = (uri: string) => Promise<{ width: number; height: number } | null>;

const readSizeWithImage: SizeReader = (uri) =>
  new Promise((resolve) => {
    try {
      Image.getSize(
        uri,
        (width, height) => resolve({ width, height }),
        () => resolve(null)
      );
    } catch {
      resolve(null);
    }
  });

export interface ExpoImageManipulatorOptions {
  /** Módulo injetável (testes). Padrão: `require('expo-image-manipulator')`. */
  manipulator?: ManipulatorModule | null;
  readSize?: SizeReader;
}

/**
 * Converte para WebP (≤ 1280 px, qualidade 0,8) com `expo-image-manipulator`,
 * carregado dinamicamente como os demais adapters de dispositivo. Sem o
 * módulo nativo ou em caso de erro, lança `ImageConversionError` — não há
 * caminho que devolva a imagem original em outro formato.
 */
export class ExpoImageManipulatorAdapter implements ImageProcessor {
  private manipulator: ManipulatorModule | null | undefined;
  private readSize: SizeReader;

  constructor(options: ExpoImageManipulatorOptions = {}) {
    this.manipulator = 'manipulator' in options ? options.manipulator : undefined;
    this.readSize = options.readSize ?? readSizeWithImage;
  }

  private load(): ManipulatorModule | null {
    if (this.manipulator !== undefined) return this.manipulator;
    try {
      this.manipulator = require('expo-image-manipulator') as ManipulatorModule;
    } catch {
      this.manipulator = null;
    }
    return this.manipulator;
  }

  async toWebp(uri: string): Promise<string> {
    const module = this.load();
    if (!module) throw new ImageConversionError();
    try {
      const size = await this.readSize(uri);
      const target = size ? fitWithin(size.width, size.height) : null;
      const needsResize = !!size && !!target && (target.width !== size.width || target.height !== size.height);
      const actions = needsResize && target ? [{ resize: { width: target.width, height: target.height } }] : [];
      const result = await module.manipulateAsync(uri, actions, {
        compress: WEBP_QUALITY,
        format: module.SaveFormat.WEBP,
      });
      return result.uri;
    } catch {
      throw new ImageConversionError();
    }
  }
}
