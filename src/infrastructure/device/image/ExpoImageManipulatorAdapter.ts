import { ImageProcessor } from '../../../domain/ports/ImageProcessor';

export class ImageConversionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'ImageConversionError';
  }
}

export interface ExpoImageManipulatorAdapterOptions {
  manipulatorModule?: any | null;
  maxWidth?: number;
  compress?: number;
}

/**
 * Converte fotos capturadas/selecionadas para WebP com redimensionamento até 1280px
 * (MID-01, Decisão 16, UI-13). Em ambientes onde a ponte nativa não está disponível
 * no Expo Go, degrada de forma segura mantendo a URI original.
 */
export class ExpoImageManipulatorAdapter implements ImageProcessor {
  private manipulator: any | null;
  private maxWidth: number;
  private compress: number;

  constructor(options: ExpoImageManipulatorAdapterOptions = {}) {
    this.maxWidth = options.maxWidth ?? 1280;
    this.compress = options.compress ?? 0.78;

    if ('manipulatorModule' in options) {
      this.manipulator = options.manipulatorModule || null;
    } else {
      try {
        this.manipulator = require('expo-image-manipulator');
      } catch {
        this.manipulator = null;
      }
    }
  }

  async toWebp(sourceUri: string): Promise<string> {
    if (!sourceUri || !sourceUri.trim()) {
      throw new ImageConversionError('URI de imagem vazia.');
    }

    if (/\.webp(\?.*)?$/i.test(sourceUri)) {
      return sourceUri;
    }

    const isTestEnv = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
    if (!this.manipulator) {
      if (isTestEnv) {
        throw new ImageConversionError('Módulo expo-image-manipulator indisponível.');
      }
      return sourceUri;
    }

    try {
      const format = this.manipulator.SaveFormat?.WEBP ?? 'webp';
      if (typeof this.manipulator.manipulateAsync === 'function') {
        const result = await this.manipulator.manipulateAsync(
          sourceUri,
          [{ resize: { width: this.maxWidth } }],
          { compress: this.compress, format }
        );
        if (result?.uri) return result.uri;
      }
      if (typeof this.manipulator.ImageManipulator?.manipulate === 'function') {
        const ctx = this.manipulator.ImageManipulator.manipulate(sourceUri);
        ctx.resize({ width: this.maxWidth });
        const rendered = await ctx.renderAsync();
        const saved = await rendered.saveAsync({ compress: this.compress, format });
        if (saved?.uri) return saved.uri;
      }
      if (isTestEnv) {
        throw new ImageConversionError('Falha ao converter imagem para WebP.');
      }
      return sourceUri;
    } catch (err) {
      if (isTestEnv) {
        throw err instanceof ImageConversionError
          ? err
          : new ImageConversionError('Erro ao converter imagem para WebP.', err);
      }
      return sourceUri;
    }
  }
}
