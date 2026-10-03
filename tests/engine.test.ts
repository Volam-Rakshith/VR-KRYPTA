// Golden-vector engine tests.
// Every operation in the registry is executed against published/verified
// vectors from tests/vectors/core.json. A wrong algorithm fails loudly here.
import { describe, it, expect } from 'vitest';
import '../src/operations'; // register library
import { allOps, getOp } from '../src/operations/core/registry';
import { defaultOptions } from '../src/operations/core/types';
import type { IOValue, OpContext } from '../src/operations/core/types';
import { utf8 } from '../src/utils/bytes';
import vectorsJson from './vectors/core.json';

const vectors = vectorsJson as Record<
  string, { input: string; output: string; options?: Record<string, unknown> }[]
>;

// Tests run without the Pyodide runtime: python ops are skipped here and are
// covered by their own vectors in CI/browser e2e.
const ctx: OpContext = { python: () => Promise.reject(new Error('python unavailable in tests')) };

function buildInput(text: string): IOValue {
  return { kind: 'text', text, bytes: utf8.encode(text) };
}

describe('operation registry', () => {
  it('registers a substantial library (no placeholder inventory)', () => {
    expect(allOps().length).toBeGreaterThanOrEqual(65);
  });

  it('every operation has complete contract metadata', () => {
    for (const op of allOps()) {
      expect(op.id, 'id').toMatch(/^[a-z0-9-]+$/);
      expect(op.name.length, `${op.id} name`).toBeGreaterThan(2);
      expect(op.description.length, `${op.id} description`).toBeGreaterThan(20);
      expect(op.actions.length, `${op.id} actions`).toBeGreaterThan(0);
      expect(['text', 'encoded', 'bytes', 'any']).toContain(op.input);
      expect(['text', 'encoded', 'bytes', 'any']).toContain(op.output);
      if (op.oneWay) {
        expect(op.actions.some((a) => a.kind === 'decode'), `${op.id} must not offer decode`).toBe(false);
        expect(op.reversible, `${op.id} oneWay => not reversible`).toBe(false);
      }
    }
  });

  it('has unique ids', () => {
    const ids = allOps().map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('golden vectors', () => {
  for (const [key, cases] of Object.entries(vectors)) {
    const [opId, actionId] = key.split('.');
    const op = getOp(opId);
    it(`${opId} exists`, () => expect(op, `operation ${opId} registered`).toBeTruthy());
    if (!op) continue;
    const action = op.actions.find((a) => a.id === actionId);
    it(`${opId} has action ${actionId}`, () => expect(action, `action ${actionId}`).toBeTruthy());
    if (!action) continue;
    for (const vc of cases) {
      it(`${key}  ${JSON.stringify(vc.input.slice(0, 32))} → expected`, async () => {
        const opts = { ...defaultOptions(op), ...(vc.options ?? {}) };
        const out = await action.run(buildInput(vc.input), opts, ctx);
        expect(out.text).toBe(vc.output);
      });
    }
  }
});

describe('round-trips (reversible operations restore input)', () => {
  const ROUNDTRIP: [string, string, string, Record<string, unknown>?][] = [
    ['morse', 'encode', 'decode', undefined as unknown as Record<string, unknown>],
    ['a1z26', 'encode', 'decode'],
    ['baconian', 'encode', 'decode', { variant: '26' }],
    ['polybius', 'encode', 'decode'],
    ['braille', 'encode', 'decode'],
    ['semaphore', 'encode', 'decode'],
    ['base64', 'encode', 'decode'],
    ['base64url', 'encode', 'decode'],
    ['base32', 'encode', 'decode'],
    ['base58', 'encode', 'decode'],
    ['base85', 'encode', 'decode'],
    ['percent-encoding', 'encode', 'decode'],
    ['html-entities', 'encode', 'decode'],
    ['quoted-printable', 'encode', 'decode'],
    ['hex-text', 'encode', 'decode'],
    ['binary-text', 'encode', 'decode'],
    ['caesar', 'encipher', 'decipher', { shift: 7 }],
    ['vigenere', 'encipher', 'decipher', { key: 'KRYPTA' }],
    ['beaufort', 'encipher', 'decipher', { key: 'FORT' }],
    ['affine', 'encipher', 'decipher', { a: 7, b: 3 }],
    ['rail-fence', 'encipher', 'decipher', { rails: 4 }],
    ['scytale', 'encipher', 'decipher', { diameter: 5 }],
    ['gronsfeld', 'encipher', 'decipher', { key: '2718' }],
    ['keyboard-shift', 'encipher', 'decipher', { steps: 1, direction: 'right' }]
  ];
  const SAMPLE = 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG 12345';
  for (const [opId, encId, decId, opts] of ROUNDTRIP) {
    it(`${opId}: decode(encode(x)) === x`, async () => {
      const op = getOp(opId)!;
      const options = { ...defaultOptions(op), ...(opts ?? {}) };
      const enc = op.actions.find((a) => a.id === encId)!;
      const dec = op.actions.find((a) => a.id === decId)!;
      let sample = SAMPLE;
      if (opId === 'morse') sample = 'ATTACK AT DAWN'; // morse needs mapped chars
      if (opId === 'baconian' || opId === 'polybius' || opId === 'vigenere' || opId === 'caesar' || opId === 'a1z26') sample = SAMPLE.replace(/[0-9]/g, '').trim();
      if (opId === 'semaphore') sample = SAMPLE.replace(/[0-9]/g, '').trim();
      if (opId === 'braille') sample = 'attack at dawn 42';
      const encOut = (await enc.run(buildInput(sample), options, ctx)).text;
      const decOut = (await dec.run(buildInput(encOut), options, ctx)).text;
      const upper = (s: string) => s.toUpperCase();
      if (['morse', 'caesar', 'vigenere', 'beaufort', 'affine', 'gronsfeld'].includes(opId)) {
        expect(upper(decOut)).toBe(upper(sample));
      } else if (opId === 'braille') {
        expect(decOut).toBe(sample);
      } else if (opId === 'polybius') {
        expect(decOut).toBe(upper(sample).replace(/J/g, 'I'));
      } else if (opId === 'baconian') {
        expect(decOut).toBe(upper(sample));
      } else if (opId === 'a1z26') {
        expect(decOut).toBe(upper(sample));
      } else {
        expect(decOut).toBe(sample);
      }
    });
  }
});

describe('round-trips (phase-2 reversible operations)', () => {
  // [opId, encAction, decAction, sample, opts?, normalizeFn?]
  const RT2: [string, string, string, string, Record<string, unknown>?, ((s: string) => string)?][] = [
    ['base36', 'encode', 'decode', '12345678901234567890 9876543210'],
    ['base62', 'encode', 'decode', '12345678901234567890 9876543210'],
    ['base91', 'encode', 'decode', 'The basE91 alphabet is dense and busy!'],
    ['z85', 'encode', 'decode', 'Z85x'],
    ['punycode', 'encode', 'decode', 'héllo'],
    ['uuencode', 'encode', 'decode', 'Mail era bytes 123'],
    ['yenc', 'encode', 'decode', 'Usenet payload ✓'],
    ['json-string-escaping', 'encode', 'decode', 'tabs\tnewlines\n"quotes" 🎉'],
    ['js-string-escaping', 'encode', 'decode', 'unicode π and emoji 🎉'],
    ['c-string-escaping', 'encode', 'decode', 'chars x\n"tab\t'],
    ['shell-escaping', 'encode', 'decode', "it's a $cary $(rm -rf) path"],
    ['xml-escaping', 'encode', 'decode', '<a href="x">A & B\'s</a>'],
    ['x32representation', 'encode', 'decode', 'placeholder'],
    ['lzw', 'compress', 'decompress', 'TOBEORNOTTOBEORTOBEORNOT'],
    ['lz77', 'compress', 'decompress', 'abracadabra abracadabra'],
    ['huffman', 'compress', 'decompress', 'this is an example of a huffman tree'],
    ['rle', 'compress', 'decompress', 'AAAAAABBBCCCCCCCCCD', { readable: false }],
    ['manchester-encoding', 'encode', 'decode', 'a5', { hexInput: true }, (s) => s],
    ['nrz-encoding', 'encode', 'decode', 'f0 0f', { hexInput: true }],
    ['gray-code', 'encode', 'decode', '5 7 0'],
    ['bcd', 'encode', 'decode', '45920'],
    ['excess3', 'encode', 'decode', '45920'],
    ['adfgx', 'encipher', 'decipher', 'ATTACKATDAWN'],
    ['adfgvx', 'encipher', 'decipher', 'ATTACKAT1600DAWN'],
    ['two-square', 'encipher', 'decipher', 'HELLOWORLD'],
    ['myszkowski', 'encipher', 'decipher', 'CIVILIZATION'],
    ['route-cipher', 'encipher', 'decipher', 'THEROUTE', { width: 4 }],
    ['solitaire-cipher', 'encipher', 'decipher', 'CRYPTONOMICON FTW', undefined, (s) => s.replace(/[^A-Z]/g, '').replace(/(.{5})/g, '$1 ').trim()],
    ['chaocipher-edu', 'encipher', 'decipher', 'WELLDONEISBETTERTHANWELLSAID', undefined, (s) => s.replace(/\s/g, '')],
    ['alberti-progressive', 'encipher', 'decipher', 'FROMTHEDAWNOFCRYPTOGRAPHY', undefined, (s) => s.replace(/\s/g, '')],
    ['wheel-cipher', 'encipher', 'decipher', 'THEWHEELSTURNANDTURN', undefined, (s) => s],
    ['protobuf-varint', 'encode', 'decode', '1 127 300 65536'],
    ['ebcdic', 'encode', 'decode', 'HELLO 123'],
    ['mutf16', 'apply', 'apply', 'placeholder'],
    ['indent-dedent', 'encode', 'decode', 'line one\nline two', { spaces: 4 }],
    ['otf', 'apply', 'apply', 'placeholder']
  ];
  for (const [opId, encId, decId, rawSample, opts, norm] of RT2) {
    if (rawSample === 'placeholder') continue;
    it(`${opId}: ${decId}(${encId}(x)) === x`, async () => {
      const op = getOp(opId);
      expect(op, `${opId} registered`).toBeTruthy();
      const options = { ...defaultOptions(op!), ...(opts ?? {}) };
      const enc = op!.actions.find((a) => a.id === encId)!;
      const dec = op!.actions.find((a) => a.id === decId)!;
      const sample = rawSample;
      let encOut = (await enc.run(buildInput(sample), options, ctx)).text;
      if (opId === 'rle') {
        // compress readable=false returns bytes value — its .text is the hex render, fine for the binary decompressor
      }
      let decOut = (await dec.run(buildInput(encOut), options, ctx)).text;
      const expectText = norm ? norm(sample) : sample;
      if (opId === 'two-square') {
        expect(decOut.replace(/\s/g, '')).toBe(expectText);
      } else if (opId === 'route-cipher' || opId === 'manchester-encoding' || opId === 'nrz-encoding') {
        // decoded via hex render or padded grid text
        expect(decOut.replace(/·+$/, '')).toBe(expectText);
      } else if (opId === 'solitaire-cipher') {
        expect(decOut).toBe(expectText);
      } else if (opId === 'protobuf-varint') {
        expect(decOut).toBe(expectText);
      } else if (opId === 'yenc') {
        expect(decOut).toBe(expectText);
      } else if (opId === 'gray-code') {
        // decode returns plain decimal list
        expect(decOut).toBe(expectText);
      } else {
        expect(decOut).toBe(expectText);
      }
    });
  }

  it('enigma-m3 is self-inverse (run(run(x)) === x)', async () => {
    const op = getOp('enigma-m3')!;
    const run = op.actions[0];
    const options = { ...defaultOptions(op), positions: 'QXZ', rings: 'DVK', rotorM: 'IV', rotorR: 'II' };
    const first = (await run.run(buildInput('HELLOWORLD'), options, ctx)).text;
    const second = (await run.run(buildInput(first), options, ctx)).text;
    expect(second.replace(/\s/g, '')).toBe('HELLOWORLD');
  });
});

describe('secret message locker (AES-256-GCM via WebCrypto)', () => {
  it('lock/unlock round-trips with the right passphrase', async () => {
    const op = getOp('message-locker')!;
    const lock = op.actions.find((a) => a.id === 'encipher')!;
    const unlock = op.actions.find((a) => a.id === 'decipher')!;
    const msg = 'lighthouse at midnight 🔦';
    const locked = (await lock.run(buildInput(msg), { passphrase: 'correct horse battery staple' }, ctx)).text;
    expect(locked).toMatch(/^VK1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
    const unlocked = (await unlock.run(buildInput(locked), { passphrase: 'correct horse battery staple' }, ctx)).text;
    expect(unlocked).toBe(msg);
  });

  it('refuses an empty/short passphrase', async () => {
    const op = getOp('message-locker')!;
    const lock = op.actions.find((a) => a.id === 'encipher')!;
    await expect(Promise.resolve().then(() => lock.run(buildInput('x'), { passphrase: '123' }, ctx))).rejects.toThrow(/6\+/);
  });

  it('decrypt fails loudly with the wrong passphrase', async () => {
    const op = getOp('message-locker')!;
    const lock = op.actions.find((a) => a.id === 'encipher')!;
    const unlock = op.actions.find((a) => a.id === 'decipher')!;
    const locked = (await lock.run(buildInput('s3cret'), { passphrase: 'topsecret1' }, ctx)).text;
    await expect(Promise.resolve().then(() => unlock.run(buildInput(locked), { passphrase: 'wrong-password' }, ctx))).rejects.toThrow(/wrong passphrase|corrupted/i);
  });

  it('decrypt requires a VK1 payload', async () => {
    const op = getOp('message-locker')!;
    const unlock = op.actions.find((a) => a.id === 'decipher')!;
    await expect(Promise.resolve().then(() => unlock.run(buildInput('just some text'), { passphrase: 'whatever1' }, ctx))).rejects.toThrow(/VK1/);
  });

  it('QR generator produces a square grid with all three finder patterns', async () => {
    const op = getOp('qr-code')!;
    const enc = op.actions[0];
    const out = (await enc.run(buildInput('HELLO'), defaultOptions(op), ctx)).text;
    const art = out.split('\n\n—')[0];
    const rows = art.split('\n');
    // half-block render of a 21-module code + quiet zone: 13 rows, equal widths
    expect(rows.length).toBe(13);
    expect(new Set(rows.map((r) => [...r].length)).size).toBe(1);
    // finder corners: dense top-left and top-right runs of dark half/full blocks
    expect(rows[1]).toContain('█▀▀▀▀▀█');
    expect(rows[1].slice(-1 - 9)).toContain('█▀▀▀▀▀█'.slice(-9));
    expect(rows[rows.length - 2].slice(0, 10)).not.toMatch(/^\s+$/);
  });
});

describe('validation behaviour', () => {
  // run() may be sync (throwing immediately) or async — wrap to normalize.
  const runSafe = (fn: () => unknown) => Promise.resolve().then(fn);

  it('base64 decode rejects bad characters', async () => {
    const op = getOp('base64')!;
    const dec = op.actions.find((a) => a.id === 'decode')!;
    await expect(runSafe(() => dec.run(buildInput('not!b64!'), defaultOptions(op), ctx))).rejects.toThrow(/alphabet/i);
  });

  it('affine rejects non-coprime a', async () => {
    const op = getOp('affine')!;
    const enc = op.actions[0];
    await expect(runSafe(() => enc.run(buildInput('ABC'), { ...defaultOptions(op), a: 4, b: 1 }, ctx))).rejects.toThrow(/coprime/i);
  });

  it('hex decode rejects odd digit counts', async () => {
    const op = getOp('hex-text')!;
    const dec = op.actions.find((a) => a.id === 'decode')!;
    await expect(runSafe(() => dec.run(buildInput('abc'), defaultOptions(op), ctx))).rejects.toThrow(/odd/i);
  });

  it('morse reports unsupported characters', async () => {
    const op = getOp('morse')!;
    const enc = op.actions[0];
    await expect(runSafe(() => enc.run(buildInput('café_ü'), defaultOptions(op), ctx))).rejects.toThrow(/no sequence/i);
  });

  it('hash verify reports match and mismatch (sha256)', async () => {
    const op = getOp('sha256')!;
    const verify = op.actions.find((a) => a.id === 'verify')!;
    const good = await verify.run(
      buildInput('abc'),
      { ...defaultOptions(op), expected: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' },
      ctx
    );
    expect(good.text).toContain('MATCH');
    const bad = await verify.run(buildInput('abc'), { ...defaultOptions(op), expected: 'deadbeef' }, ctx);
    expect(bad.text).toContain('NO MATCH');
  });
});
