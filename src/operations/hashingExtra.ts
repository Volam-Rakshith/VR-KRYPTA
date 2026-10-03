// Extended hashing & integrity: SHA-2 expansion, SHA-3 XOFs, BLAKE3,
// RIPEMD-160, classic checksums (CRC/Adler/FNV/xxHash), keyed constructions
// (HMAC/HKDF/PBKDF2), Merkle trees and byte fingerprinting.
import { sha224, sha512_224, sha512_256, sha256 } from '@noble/hashes/sha2.js';
import { shake128, shake256 } from '@noble/hashes/sha3.js';
import { blake3 } from '@noble/hashes/blake3.js';
import { blake2b, blake2s } from '@noble/hashes/blake2.js';
import { ripemd160 } from '@noble/hashes/legacy.js';
import { hmac } from '@noble/hashes/hmac.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { md5 } from './hashing';
import { defineOp } from './core/registry';
import { textValue } from './core/types';
import { utf8, hexToBytes, bytesToHex } from '../utils/bytes';

function inBytes(v: { text: string; bytes?: Uint8Array }, hexInput: unknown): Uint8Array {
  if (hexInput) return hexToBytes(v.text);
  return v.bytes ?? utf8.encode(v.text);
}

function digestOp(cfg: {
  id: string; name: string; desc: string; digest: (b: Uint8Array) => Uint8Array;
  aliases?: string[]; warning?: string; tags?: string[];
}) {
  defineOp({
    id: cfg.id,
    name: cfg.name,
    category: 'hashing',
    description: cfg.desc,
    aliases: cfg.aliases,
    tags: cfg.tags ?? ['hash', 'digest', 'one-way'],
    input: 'any',
    output: 'encoded',
    reversible: false,
    oneWay: true,
    engine: 'typescript',
    options: [
      { type: 'toggle', key: 'hexInput', label: 'Input is hexadecimal bytes', default: false },
      { type: 'text', key: 'expected', label: 'Expected (for Verify)', default: '' }
    ],
    actions: [
      {
        id: 'hash', label: 'Hash', kind: 'hash',
        run: (v, o) => textValue(bytesToHex(cfg.digest(inBytes(v, o.hexInput)), ''), 'encoded')
      },
      {
        id: 'verify', label: 'Verify', kind: 'verify',
        run: (v, o) => {
          const expected = String(o.expected ?? '').trim().toLowerCase().replace(/[^0-9a-f]/g, '');
          if (!expected) throw new Error('Paste the expected digest into the option field first.');
          const actual = bytesToHex(cfg.digest(inBytes(v, o.hexInput)), '');
          return textValue(actual === expected ? `✔ MATCH\n${actual}` : `✘ NO MATCH\ncomputed: ${actual}\nexpected: ${expected}`);
        }
      }
    ],
    warnings: cfg.warning ? [cfg.warning] : undefined
  });
}

digestOp({ id: 'sha224', name: 'SHA-224', desc: 'SHA-2 family digest with a 224-bit output (truncated SHA-256 variant), via the audited @noble/hashes implementation.', digest: (b) => sha224(b), aliases: ['sha-224'] });
digestOp({ id: 'sha512-224', name: 'SHA-512/224', desc: 'A 224-bit truncation of SHA-512 — often faster than SHA-224 on 64-bit platforms.', digest: (b) => sha512_224(b), aliases: ['sha-512/224'] });
digestOp({ id: 'sha512-256', name: 'SHA-512/256', desc: 'A 256-bit truncation of SHA-512 from the SHA-2 family.', digest: (b) => sha512_256(b), aliases: ['sha-512/256'] });
digestOp({ id: 'shake128', name: 'SHAKE128 (32-byte)', desc: 'SHA-3 extendable-output function (128-bit security), 256 bits of output here.', digest: (b) => shake128(b, { dkLen: 32 }), aliases: ['shake-128', 'xof'] });
digestOp({ id: 'blake3', name: 'BLAKE3', desc: 'Modern tree-mode hash — extremely fast while cryptographically conservative. Audited @noble/hashes BLAKE3.', digest: (b) => blake3(b), aliases: ['b3', 'blake 3'] });
digestOp({ id: 'ripemd160', name: 'RIPEMD-160', desc: '160-bit European hash (Bitcoin addresses hash public keys with SHA-256 then RIPEMD-160).', digest: (b) => ripemd160(b), aliases: ['ripemd-160', 'ripemd'], warning: 'RIPEMD-160 is adequate for some legacy uses but has a 160-bit security bound — prefer SHA-256 or BLAKE2/3 in new designs.' });
digestOp({ id: 'blake2b-ts', name: 'BLAKE2b (TypeScript)', desc: 'BLAKE2b from @noble/hashes, no Python runtime needed — same digest as the Pyodide-backed copy.', digest: (b) => blake2b(b), aliases: ['blake2b fast'] });
digestOp({ id: 'blake2s-ts', name: 'BLAKE2s (TypeScript)', desc: 'BLAKE2s (32-bit-word BLAKE2) from @noble/hashes.', digest: (b) => blake2s(b), aliases: ['blake2s fast'] });

/* ------------------------------ classic checksums ------------------------- */

function crcTable(poly: number, reflected: boolean): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    if (reflected) {
      for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ poly : c >>> 1;
    } else {
      c <<= 24;
      for (let k = 0; k < 8; k++) c = c & 0x80000000 ? ((c << 1) ^ poly) >>> 0 : (c << 1) >>> 0;
    }
    table[i] = c >>> 0;
  }
  return table;
}

const CRC32_TABLE = crcTable(0xedb88320, true);
const CRC16_TABLE = crcTable(0xa001, true);

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of data) c = (c >>> 8) ^ CRC32_TABLE[(c ^ b) & 0xff];
  return (c ^ 0xffffffff) >>> 0;
}

function crc16arc(data: Uint8Array): number {
  let c = 0x0000;
  for (const b of data) c = ((c >>> 8) ^ CRC16_TABLE[(c ^ b) & 0xff]) & 0xffff;
  return c;
}

function crc8Smbus(data: Uint8Array): number {
  let c = 0;
  for (const b of data) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 0x80 ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff;
  }
  return c;
}

function adler32(data: Uint8Array): number {
  let a = 1, b = 0;
  const MOD = 65521;
  for (const x of data) {
    a = (a + x) % MOD;
    b = (b + a) % MOD;
  }
  return ((b << 16) | a) >>> 0;
}

function fnv1a32(data: Uint8Array): number {
  let h = 0x811c9dc5;
  for (const b of data) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  return h >>> 0;
}

function fnv1a64(data: Uint8Array): bigint {
  let h = 0xcbf29ce484222325n;
  const P = 0x100000001b3n;
  const M = 0xffffffffffffffffn;
  for (const b of data) h = ((h ^ BigInt(b)) * P) & M;
  return h;
}

function checksumOp(cfg: { id: string; name: string; desc: string; fn: (b: Uint8Array) => string; aliases?: string[] }) {
  defineOp({
    id: cfg.id,
    name: cfg.name,
    category: 'hashing',
    description: cfg.desc,
    aliases: cfg.aliases,
    tags: ['checksum', 'integrity', 'hash'],
    input: 'any',
    output: 'encoded',
    reversible: false,
    oneWay: true,
    engine: 'typescript',
    options: [{ type: 'toggle', key: 'hexInput', label: 'Input is hexadecimal bytes', default: false }],
    actions: [
      { id: 'hash', label: 'Compute', kind: 'hash', run: (v, o) => textValue(cfg.fn(inBytes(v, o.hexInput)), 'encoded') }
    ],
    warnings: ['Checksums detect accidental corruption only — they are not cryptographic and cannot resist intentional tampering.']
  });
}

checksumOp({
  id: 'crc32', name: 'CRC-32 (IEEE)',
  desc: 'The Ethernet/ZIP cyclic redundancy check (reflected, poly 0xEDB88320), output as 8 hex digits.',
  fn: (b) => crc32(b).toString(16).padStart(8, '0'), aliases: ['crc-32', 'zip crc']
});
checksumOp({
  id: 'crc16', name: 'CRC-16/ARC',
  desc: 'Classic 16-bit CRC (reflected poly 0xA001, init 0), output as 4 hex digits.',
  fn: (b) => crc16arc(b).toString(16).padStart(4, '0'), aliases: ['crc-16']
});
checksumOp({
  id: 'crc8', name: 'CRC-8/SMBus',
  desc: 'One-byte CRC (poly 0x07, init 0), output as 2 hex digits.',
  fn: (b) => crc8Smbus(b).toString(16).padStart(2, '0'), aliases: ['crc-8']
});
checksumOp({
  id: 'adler32', name: 'Adler-32',
  desc: 'zlib\'s fast checksum (two 16-bit running sums), output as 8 hex digits.',
  fn: (b) => adler32(b).toString(16).padStart(8, '0'), aliases: ['adler-32', 'zlib checksum']
});
checksumOp({
  id: 'fnv1a', name: 'FNV-1a (32 & 64)',
  desc: 'Fowler–Noll–Vo alternate hash — a tiny, fast non-crypto hash. Both widths shown.',
  fn: (b) => `32-bit: ${fnv1a32(b).toString(16).padStart(8, '0')}\n64-bit: ${fnv1a64(b).toString(16).padStart(16, '0')}`,
  aliases: ['fnv', 'fnv-1a']
});

/* --------------------------------- xxHash --------------------------------- */

const rotl32 = (x: number, n: number) => ((x << n) | (x >>> (32 - n))) >>> 0;

function xxh32(data: Uint8Array, seed: number): number {
  const P1 = 0x9e3779b1, P2 = 0x85ebca77, P3 = 0xc2b2ae3d, P4 = 0x27d4eb2f, P5 = 0x165667b1;
  let p = 0;
  const n = data.length;
  let h: number;
  if (n >= 16) {
    let v1 = (seed + P1 + P2) >>> 0, v2 = (seed + P2) >>> 0, v3 = seed >>> 0, v4 = (seed - P1) >>> 0;
    const lane = (v: number, i: number) => {
      const k = data[i] | (data[i + 1] << 8) | (data[i + 2] << 16) | (data[i + 3] << 24);
      return Math.imul(rotl32((v + Math.imul(k >>> 0, P2)) >>> 0, 13), P1) >>> 0;
    };
    for (; p + 16 <= n; p += 16) {
      v1 = lane(v1, p); v2 = lane(v2, p + 4); v3 = lane(v3, p + 8); v4 = lane(v4, p + 12);
    }
    h = (rotl32(v1, 1) + rotl32(v2, 7) + rotl32(v3, 12) + rotl32(v4, 18)) >>> 0;
  } else h = (seed + P5) >>> 0;
  h = (h + n) >>> 0;
  for (; p + 4 <= n; p += 4) {
    const k = data[p] | (data[p + 1] << 8) | (data[p + 2] << 16) | (data[p + 3] << 24);
    h = Math.imul(rotl32((h + Math.imul(k >>> 0, P3)) >>> 0, 17), P4) >>> 0;
  }
  for (; p < n; p++) h = Math.imul(rotl32((h + Math.imul(data[p], P5)) >>> 0, 11), P1) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, P2) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, P3) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

const M64 = (1n << 64n) - 1n;
const rotl64 = (x: bigint, n: bigint) => ((x << n) | (x >> (64n - n))) & M64;

function xxh64(data: Uint8Array, seed: bigint): bigint {
  const P1 = 11400714785074694791n, P2 = 14029467366897019727n, P3 = 1609587929392839161n,
    P4 = 9650029242287828579n, P5 = 2870177450012600261n;
  const n = data.length;
  let p = 0, h: bigint;
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (n >= 32) {
    let v1 = (seed + P1 + P2) & M64, v2 = (seed + P2) & M64, v3 = seed, v4 = (seed - P1) & M64;
    const round = (v: bigint, lane: bigint) => rotl64((v + lane * P2) & M64, 31n) * P1 & M64;
    for (; p + 32 <= n; p += 32) {
      v1 = round(v1, dv.getBigUint64(p, true));
      v2 = round(v2, dv.getBigUint64(p + 8, true));
      v3 = round(v3, dv.getBigUint64(p + 16, true));
      v4 = round(v4, dv.getBigUint64(p + 24, true));
    }
    h = (rotl64(v1, 1n) + rotl64(v2, 7n) + rotl64(v3, 12n) + rotl64(v4, 18n)) & M64;
    for (const v of [v1, v2, v3, v4]) {
      const acc = rotl64((v * P2) & M64, 31n) * P1 & M64;
      h = ((h ^ acc) * P1 + P4) & M64;
    }
  } else h = (seed + P5) & M64;
  h = (h + BigInt(n)) & M64;
  for (; p + 8 <= n; p += 8) {
    const k = rotl64(dv.getBigUint64(p, true) * P2 & M64, 31n) * P1 & M64;
    h = (rotl64(h ^ k, 27n) * P1 + P4) & M64;
  }
  if (p + 4 <= n) {
    h = (rotl64(h ^ BigInt(dv.getUint32(p, true)) * P1 & M64, 23n) * P2 + P3) & M64;
    p += 4;
  }
  for (; p < n; p++) {
    h = (rotl64(h ^ BigInt(data[p]) * P5 & M64, 11n) * P1) & M64;
  }
  h ^= h >> 33n; h = h * P2 & M64;
  h ^= h >> 29n; h = h * P3 & M64;
  h ^= h >> 32n;
  return h;
}

checksumOp({
  id: 'xxhash', name: 'xxHash (32 & 64)',
  desc: 'Extremely fast non-cryptographic hash used in databases and file systems. Seed 0, both widths shown.',
  fn: (b) => `xxh32: ${xxh32(b, 0).toString(16).padStart(8, '0')}\nxxh64: ${xxh64(b, 0n).toString(16).padStart(16, '0')}`,
  aliases: ['xxh32', 'xxh64', 'xxhash64']
});

/* --------------------------- keyed constructions --------------------------- */

defineOp({
  id: 'hmac-sha256',
  name: 'HMAC-SHA-256',
  category: 'hashing',
  description: 'Keyed hash for message AUTHENTICITY — unlike a bare hash, verifying requires the shared secret.',
  aliases: ['hmac', 'message authentication code', 'mac'],
  tags: ['hash', 'hmac', 'authenticity', 'keyed'],
  input: 'text',
  output: 'encoded',
  reversible: false,
  oneWay: true,
  engine: 'typescript',
  options: [
    { type: 'text', key: 'key', label: 'Secret key', default: 'krypta-secret', help: 'Any text — this is what makes HMAC different from a plain hash.' },
    { type: 'text', key: 'expected', label: 'Expected MAC (for Verify)', default: '' }
  ],
  actions: [
    {
      id: 'hash', label: 'Compute MAC', kind: 'hash',
      run: (v, o) => {
        if (!String(o.key ?? '')) throw new Error('HMAC requires a secret key.');
        return textValue(bytesToHex(hmac(sha256, utf8.encode(String(o.key)), v.bytes ?? utf8.encode(v.text)), ''), 'encoded');
      }
    },
    {
      id: 'verify', label: 'Verify MAC', kind: 'verify',
      run: (v, o) => {
        const expected = String(o.expected ?? '').trim().toLowerCase().replace(/[^0-9a-f]/g, '');
        if (!expected) throw new Error('Paste the expected MAC first.');
        const actual = bytesToHex(hmac(sha256, utf8.encode(String(o.key ?? '')), v.bytes ?? utf8.encode(v.text)), '');
        return textValue(actual === expected
          ? '✔ MATCH — the message is authentic under your key.\n(A bare hash could never prove this; only the key holder can produce this MAC.)'
          : '✘ NO MATCH — wrong message, wrong key, or tampered MAC.');
      }
    }
  ],
  docs: 'This is what “a hash proves authenticity” actually requires: a secret key. HMAC-SHA-256 is appropriate; bare MD5/SHA are not.'
});

defineOp({
  id: 'hkdf-sha256',
  name: 'HKDF-SHA-256',
  category: 'hashing',
  description: 'Key-derivation function (RFC 5869): expands input key material into cryptographically independent output keys.',
  aliases: ['hkdf', 'key derivation', 'expand extract'],
  tags: ['hash', 'kdf', 'keys'],
  input: 'text',
  output: 'encoded',
  reversible: false,
  oneWay: true,
  engine: 'typescript',
  options: [
    { type: 'text', key: 'salt', label: 'Salt (optional)', default: '' },
    { type: 'text', key: 'info', label: 'Info / context string', default: 'vr-krypta' },
    { type: 'number', key: 'length', label: 'Output bytes', default: 32, min: 1, max: 128 }
  ],
  actions: [
    {
      id: 'derive', label: 'Derive key', kind: 'transform',
      run: (v, o) => {
        const okm = hkdf(sha256, v.bytes ?? utf8.encode(v.text), utf8.encode(String(o.salt ?? '')), utf8.encode(String(o.info ?? '')), Number(o.length ?? 32));
        return textValue(bytesToHex(okm, ''), 'encoded');
      }
    }
  ],
  docs: 'HKDF turns high-entropy key material into fresh keys. A different Info string yields independent keys from the same input.'
});

defineOp({
  id: 'pbkdf2-sha256',
  name: 'PBKDF2-SHA-256',
  category: 'hashing',
  description: 'Password-based key derivation (RFC 8018): deliberately slow salted hashing for passwords and passphrases.',
  aliases: ['pbkdf2', 'password hash', 'password derivation'],
  tags: ['hash', 'kdf', 'password'],
  input: 'text',
  output: 'encoded',
  reversible: false,
  oneWay: true,
  engine: 'typescript',
  options: [
    { type: 'text', key: 'salt', label: 'Salt', default: 'vr-krypta', help: 'Should be random and unique per password in real systems.' },
    { type: 'number', key: 'iterations', label: 'Iterations', default: 100000, min: 1, max: 2000000 },
    { type: 'number', key: 'length', label: 'Output bytes', default: 32, min: 1, max: 64 }
  ],
  actions: [
    {
      id: 'derive', label: 'Derive', kind: 'transform',
      run: (v, o) => {
        const dk = pbkdf2(sha256, v.bytes ?? utf8.encode(v.text), utf8.encode(String(o.salt ?? '')), { c: Number(o.iterations ?? 100000), dkLen: Number(o.length ?? 32) });
        return textValue(bytesToHex(dk, ''), 'encoded');
      }
    }
  ],
  warnings: ['PBKDF2 is acceptable but dated for new password storage — modern systems prefer Argon2id or scrypt (not included here to avoid unvetted implementations).']
});

/* ------------------------------ merkle & fingerprint ----------------------- */

defineOp({
  id: 'merkle-tree',
  name: 'Merkle Tree Builder',
  category: 'hashing',
  description: 'Builds a SHA-256 Merkle (hash) tree from one leaf per input line and reports the root — the structure behind blockchains and certificate transparency.',
  aliases: ['merkle root', 'hash tree'],
  tags: ['hash', 'merkle', 'tree'],
  input: 'text',
  output: 'text',
  reversible: false,
  oneWay: true,
  engine: 'typescript',
  actions: [
    {
      id: 'build', label: 'Build tree', kind: 'transform',
      run: (v) => {
        const leaves = v.text.split('\n').map((s) => s.trim()).filter(Boolean);
        if (leaves.length === 0) throw new Error('Provide at least one line — each line becomes a leaf.');
        if (leaves.length > 256) throw new Error('Limit: 256 leaves.');
        const hex = (b: Uint8Array) => bytesToHex(b, '');
        let level = leaves.map((s) => hex(sha256(utf8.encode(s))));
        const layers: string[] = [`Leaves (${level.length}):`];
        level.forEach((h, i) => layers.push(`  [${i}] ${h.slice(0, 16)}…`));
        while (level.length > 1) {
          const next: string[] = [];
          for (let i = 0; i < level.length; i += 2) {
            const left = level[i];
            const right = level[i + 1] ?? level[i]; // odd leaf duplicates (Bitcoin convention)
            next.push(hex(sha256(utf8.encode(left + right))));
          }
          layers.push(`Level ${layers.length === 1 ? 1 : ''} (${next.length} node${next.length === 1 ? '' : 's'}):`);
          next.forEach((h, i) => layers.push(`  [${i}] ${h.slice(0, 16)}…`));
          level = next;
        }
        layers.push('');
        layers.push(`ROOT: ${level[0]}`);
        layers.push('');
        layers.push('Changing any single leaf changes the root — that is the integrity guarantee.');
        return textValue(layers.join('\n'));
      }
    }
  ],
  examples: [{ label: 'Four leaves', input: 'block 1\ntransaction 2\nreceipt 3\nnote 4' }]
});

defineOp({
  id: 'fingerprint',
  name: 'Byte Fingerprint Report',
  category: 'hashing',
  description: 'One-shot identity card for any byte string: MD5, SHA-256, BLAKE3, CRC-32, Adler-32 and size — paste hex or use Load file in the workspace.',
  aliases: ['file fingerprint', 'checksum file', 'hash everything', 'hash report'],
  tags: ['hash', 'fingerprint', 'integrity', 'file'],
  input: 'any',
  output: 'text',
  reversible: false,
  engine: 'typescript',
  options: [
    { type: 'toggle', key: 'hexInput', label: 'Input is hexadecimal bytes', default: false },
    { type: 'text', key: 'expectedSha256', label: 'Expected SHA-256 (optional)', default: '' }
  ],
  actions: [
    {
      id: 'analyze', label: 'Fingerprint', kind: 'analyze',
      run: (v, o) => {
        const data = inBytes(v, o.hexInput);
        const sha = bytesToHex(sha256(data), '');
        const lines = [
          `Size:      ${data.length} byte${data.length === 1 ? '' : 's'}`,
          `MD5:       ${bytesToHex(md5(data), '')}`,
          `SHA-256:   ${sha}`,
          `BLAKE3:    ${bytesToHex(blake3(data), '')}`,
          `RIPEMD160: ${bytesToHex(ripemd160(data), '')}`,
          `CRC-32:    ${crc32(data).toString(16).padStart(8, '0')}`,
          `Adler-32:  ${adler32(data).toString(16).padStart(8, '0')}`
        ];
        const expected = String(o.expectedSha256 ?? '').trim().toLowerCase().replace(/[^0-9a-f]/g, '');
        if (expected) lines.push('', expected === sha ? `✔ SHA-256 matches the expected digest.` : `✘ SHA-256 does NOT match expected:\n  ${expected}`);
        return textValue(lines.join('\n'));
      }
    }
  ],
  docs: 'Expect this to be used with the workspace “Load file” button: it reads any file into hexadecimal, so you can fingerprint real files without uploading them.',
  warnings: ['MD5 appears for compatibility with existing checksum lists only — do not rely on it for tamper detection.']
});
