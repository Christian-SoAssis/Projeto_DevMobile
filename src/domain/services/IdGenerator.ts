/**
 * UUID v4 para ids criados no aparelho (anúncios, fotos). O Supabase usa
 * `uuid` nas chaves primárias, então ids como `anim_<timestamp>` seriam
 * rejeitados na sincronização. Não é uso criptográfico — só unicidade.
 */
export function newUuid(random: () => number = Math.random): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
