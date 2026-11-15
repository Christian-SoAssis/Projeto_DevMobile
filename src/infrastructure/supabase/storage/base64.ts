const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64ToBytes(base64: string): Uint8Array {
  const cleaned = base64.replace(/^data:[^;]+;base64,/, '').replace(/[\r\n\s]/g, '');
  const len = cleaned.length;
  if (len === 0) return new Uint8Array(0);

  const pad = cleaned.endsWith('==') ? 2 : cleaned.endsWith('=') ? 1 : 0;
  const byteLength = Math.floor((len * 3) / 4) - pad;
  const bytes = new Uint8Array(Math.max(0, byteLength));

  let byteIndex = 0;
  for (let i = 0; i < len; i += 4) {
    const c1 = BASE64_CHARS.indexOf(cleaned[i]);
    const c2 = BASE64_CHARS.indexOf(cleaned[i + 1]);
    const c3 = cleaned[i + 2] === '=' ? 0 : BASE64_CHARS.indexOf(cleaned[i + 2]);
    const c4 = cleaned[i + 3] === '=' ? 0 : BASE64_CHARS.indexOf(cleaned[i + 3]);

    const triplet = ((c1 & 63) << 18) | ((c2 & 63) << 12) | ((c3 & 63) << 6) | (c4 & 63);
    if (byteIndex < byteLength) bytes[byteIndex++] = (triplet >> 16) & 0xff;
    if (byteIndex < byteLength) bytes[byteIndex++] = (triplet >> 8) & 0xff;
    if (byteIndex < byteLength) bytes[byteIndex++] = triplet & 0xff;
  }

  return bytes;
}
