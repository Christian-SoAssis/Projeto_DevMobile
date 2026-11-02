/** Falha ao converter a imagem; a mensagem é apresentável ao usuário. */
export class ImageConversionError extends Error {
  constructor(message = 'Não foi possível processar a foto. Tente outra imagem.') {
    super(message);
    this.name = 'ImageConversionError';
  }
}

/**
 * Converte imagens para o formato único aceito pelo app e pelo bucket
 * (WebP, redimensionada e comprimida). A conversão é obrigatória: nenhuma
 * foto é guardada ou enviada em outro formato.
 */
export interface ImageProcessor {
  /** Devolve a URI local do arquivo WebP gerado. Lança `ImageConversionError` se falhar. */
  toWebp(uri: string): Promise<string>;
}
