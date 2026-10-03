// Hashing: one-way digests. There is intentionally NO decode action — a hash
// can be computed and verified, never reversed. MD5/SHA-1 carry explicit
// collision warnings.
import { defineOp } from './core/registry';
import { textValue } from './core/types';
import { utf8, hexToBytes, bytesToHex } from '../utils/bytes';

/* --------------------------- Pure-TS MD5 (RFC 1321) ------------------------ */

const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
];
const MD5_K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);

function rotl32(x: number, n: number): number {
  return ((x << n) | (x >>> (32 - n))) >>> 0;
}

export function md5(data: Uint8Array): Uint8Array {
  const bitLen = data.length * 8;
  const paddedLen = (((data.length + 8) >> 6) + 1) << 6;
  const msg = new Uint8Array(paddedLen);
  msg.set(data);
  msg[data.length] = 0x80;
  const dv = new DataView(msg.buffer);
  // 64-bit little-endian length; byte lengths here never exceed 2^53.
  dv.setUint32(paddedLen - 8, bitLen >>> 0, true);
  dv.setUint32(paddedLen - 4, Math.floor(bitLen / 2 ** 32), true);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;

  for (let off = 0; off < paddedLen; off += 64) {
    const M = new Uint32Array(16);
    for (let i = 0; i < 16; i++) M[i] = dv.getUint32(off + i * 4, true);
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F: number, g: number;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + MD5_K[i] + M[g]) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + rotl32(F, MD5_S[i])) >>> 0;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  const odv = new DataView(out.buffer);
  odv.setUint32(0, a0, true);
  odv.setUint32(4, b0, true);
  odv.setUint32(8, c0, true);
  odv.setUint32(12, d0, true);
  return out;
}

/* ------------------------------ Web Crypto SHA ----------------------------- */

async function webDigest(algo: string, data: Uint8Array): Promise<Uint8Array> {
  const buf = await crypto.subtle.digest(algo, data as BufferSource);
  return new Uint8Array(buf);
}

function inputBytes(v: { text: string; bytes?: Uint8Array }, hexInput: unknown): Uint8Array {
  if (hexInput) return hexToBytes(v.text);
  return v.bytes ?? utf8.encode(v.text);
}

function hashOp(cfg: {
  id: string; name: string; digest: (b: Uint8Array) => Promise<Uint8Array> | Uint8Array;
  aliases?: string[]; warning?: string; docs?: string;
}) {
  defineOp({
    id: cfg.id,
    name: cfg.name,
    category: 'hashing',
    description: cfg.docs ?? `Computes the ${cfg.name} digest of the input and shows it as lowercase hex. One-way by design.`,
    aliases: cfg.aliases,
    tags: ['hash', 'digest', 'one-way', 'checksum'],
    input: 'any',
    output: 'encoded',
    reversible: false,
    oneWay: true,
    engine: cfg.id === 'md5' ? 'typescript' : 'browser',
    options: [
      { type: 'toggle', key: 'hexInput', label: 'Input is hexadecimal bytes', default: false },
      { type: 'toggle', key: 'uppercase', label: 'Uppercase hex output', default: false },
      { type: 'text', key: 'expected', label: 'Expected digest (for Verify)', default: '', placeholder: 'paste hex digest here' }
    ],
    actions: [
      {
        id: 'hash', label: 'Hash', kind: 'hash',
        run: async (v, o) => {
          const d = await cfg.digest(inputBytes(v, o.hexInput));
          const hex = bytesToHex(d, '');
          return textValue(o.uppercase ? hex.toUpperCase() : hex, 'encoded');
        }
      },
      {
        id: 'verify', label: 'Verify digest', kind: 'verify',
        run: async (v, o) => {
          const expected = String(o.expected ?? '').trim().toLowerCase().replace(/[^0-9a-f]/g, '');
          if (!expected) throw new Error('Paste the expected digest into the "Expected digest" option first.');
          const d = await cfg.digest(inputBytes(v, o.hexInput));
          const actual = bytesToHex(d, '');
          return textValue(
            actual === expected
              ? `✔ MATCH — the input produces the expected ${cfg.name} digest.\n${actual}`
              : `✘ NO MATCH\ncomputed: ${actual}\nexpected: ${expected}\n\nThe input differs from whatever produced the expected digest.`
          );
        }
      }
    ],
    docs: 'Verification compares your input\'s digest to an expected value you paste here. A match proves only that this exact input maps to that digest — authenticity requires a keyed mechanism (HMAC), not a bare hash.',
    warnings: cfg.warning ? [cfg.warning] : undefined
  });
}

hashOp({
  id: 'md5', name: 'MD5',
  digest: (b) => md5(b),
  aliases: ['md5sum', 'message digest 5'],
  warning: 'MD5 is cryptographically broken (collisions are practical). Suitable only for non-adversarial checksums — never for passwords, signatures or integrity against attackers.'
});
hashOp({
  id: 'sha1', name: 'SHA-1',
  digest: (b) => webDigest('SHA-1', b),
  aliases: ['sha-1', 'sha1'],
  warning: 'SHA-1 is broken for collision resistance (SHAttered, 2017). Do not use it in new security designs.'
});
hashOp({ id: 'sha256', name: 'SHA-256', digest: (b) => webDigest('SHA-256', b), aliases: ['sha-256', 'sha2'] });
hashOp({ id: 'sha384', name: 'SHA-384', digest: (b) => webDigest('SHA-384', b), aliases: ['sha-384'] });
hashOp({ id: 'sha512', name: 'SHA-512', digest: (b) => webDigest('SHA-512', b), aliases: ['sha-512'] });
