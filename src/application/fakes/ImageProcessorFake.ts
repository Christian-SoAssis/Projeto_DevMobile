import { ImageConversionError, ImageProcessor } from '../../domain/ports/ImageProcessor';

export class ImageProcessorFake implements ImageProcessor {
  public converted: string[] = [];
  public shouldFail = false;

  async toWebp(uri: string): Promise<string> {
    if (this.shouldFail) throw new ImageConversionError();
    this.converted.push(uri);
    return uri.replace(/\.[a-z0-9]+$/i, '') + '.webp';
  }
}
