/**
 * Logger leve de diagnóstico para capturar avisos de fallback offline/rede
 * sem engolir erros silenciosamente.
 */
export const logger = {
  warn(context: string, error?: unknown): void {
    if (process.env.NODE_ENV === 'test') return;
    const msg = error instanceof Error ? error.message : String(error ?? '');
    console.warn(`[Enlace:${context}]`, msg);
  },
};
