// Byte / text / hex primitives shared by every operation module.

export const utf8 = {
  encode(s: string): Uint8Array {
    return new TextEncoder().encode(s);
  },
  decode(b: Uint8Array): string {
    return new TextDecoder('utf-8', { fatal: false }).decode(b);
  },
  decodeStrict(b: Uint8Array): string {
    return new TextDecoder('utf-8', { fatal: true }).decode(b);
  }
};

export function bytesToHex(b: Uint8Array, sep = ' '): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(sep);
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, '');
  if (clean.length === 0) throw new Error('No hexadecimal digits found in input.');
  if (clean.length % 2 !== 0) throw new Error('Hex input has an odd number of digits — check for a truncated byte.');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToBinary(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(2).padStart(8, '0')).join(' ');
}

export function binaryToBytes(bin: string): Uint8Array {
  const clean = bin.replace(/[^01]/g, '');
  if (clean.length === 0) throw new Error('No binary digits found in input.');
  if (clean.length % 8 !== 0) throw new Error(`Binary input has ${clean.length} bits — not a whole number of bytes.`);
  const out = new Uint8Array(clean.length / 8);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 8, i * 8 + 8), 2);
  return out;
}

/** Big-endian integer helpers for number-theory style encodings. */
export function bytesToBigInt(b: Uint8Array): bigint {
  let n = 0n;
  for (const x of b) n = (n << 8n) | BigInt(x);
  return n;
}

export function bigIntToBytes(n: bigint, minLen: number): Uint8Array {
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.unshift(Number(n & 255n));
    n >>= 8n;
  }
  while (bytes.length < minLen) bytes.unshift(0);
  return new Uint8Array(bytes);
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

export function isHexish(s: string): boolean {
  const clean = s.replace(/[^0-9a-fA-F]/g, '');
  return clean.length > 0 && clean.length % 2 === 0 && clean.replace(/[0-9a-fA-F]/g, '').length === 0;
}

export const ASCII_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function onlyLetters(s: string): string {
  return s.toUpperCase().replace(/[^A-Z]/g, '');
}

export function unsupportedLetters(s: string, allowed: RegExp): string[] {
  const bad = new Set<string>();
  for (const ch of s.toUpperCase()) if (/[A-Z0-9]/.test(ch) && !allowed.test(ch)) bad.add(ch);
  return [...bad];
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Classic Polybius square builder with a key-ordered alphabet. */
export function keyedAlphabet(key: string, base: string = ASCII_LETTERS): string {
  const seen = new Set<string>();
  let out = '';
  for (const ch of (key.toUpperCase() + base)) {
    if (base.includes(ch) && !seen.has(ch)) {
      seen.add(ch);
      out += ch;
    }
  }
  return out;
}
