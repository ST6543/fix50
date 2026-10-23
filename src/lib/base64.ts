/**
 * Pure base64-helpers (zonder atob/btoa/Buffer) — werken op native, web en
 * in Node/Jest. Gebruikt voor foto-uploads (Supabase Storage) en het embedden
 * van foto's als data-URI in de PDF-dossiers.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i++) LOOKUP[ALPHABET[i]!] = i;
LOOKUP['-'] = 62; // base64url-tolerantie
LOOKUP['_'] = 63;

/** Uint8Array → base64-string (gechunkt om call-stack-limieten te vermijden). */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    let buf = '';
    for (let j = 0; j < slice.length; j += 3) {
      const b0 = slice[j]!;
      const b1 = j + 1 < slice.length ? slice[j + 1]! : 0;
      const b2 = j + 2 < slice.length ? slice[j + 2]! : 0;
      const triple = (b0 << 16) | (b1 << 8) | b2;
      buf += ALPHABET[(triple >> 18) & 63]!;
      buf += ALPHABET[(triple >> 12) & 63]!;
      buf += j + 1 < slice.length ? ALPHABET[(triple >> 6) & 63]! : '=';
      buf += j + 2 < slice.length ? ALPHABET[triple & 63]! : '=';
    }
    out += buf;
  }
  return out;
}

/** base64-string → Uint8Array (whitespace en padding worden genegeerd). */
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[\r\n\t =]/g, '');
  const len = clean.length;
  const bytes = new Uint8Array(Math.max(0, Math.floor((len * 3) / 4) - (clean[len - 1] === '=' ? 1 : 0) - (clean[len - 2] === '=' ? 1 : 0)));
  let p = 0;
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < len; i++) {
    const v = LOOKUP[clean[i]!];
    if (v === undefined) continue;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[p++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes.subarray(0, p);
}

/** Detecteert het mime-type van fotobytes (jpeg of png); fallback jpeg. */
export function detectImageMime(bytes: Uint8Array): string {
  if (bytes.length > 3 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  if (bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return 'image/jpeg';
  }
  if (bytes.length > 3 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return 'image/webp';
  }
  return 'image/jpeg';
}
