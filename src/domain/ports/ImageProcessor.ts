export interface ImageProcessor {
  toWebp(sourceUri: string): Promise<string>;
}
