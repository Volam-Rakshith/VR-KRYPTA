import { describe, it, expect } from 'vitest';
import '../src/operations';
import { analyze, englishScore, shannon, profile, indexOfCoincidence } from '../src/services/detect';
import { inkEncode } from '../src/operations/invisibleInk';
import { emojiEncode } from '../src/operations/emojiSkin';

describe('detect primitives', () => {
  it('englishScore separates English from noise', () => {
    expect(englishScore('the quick brown fox jumps over the lazy dog')).toBeGreaterThan(0.6);
    expect(englishScore('xqzjkvfw btngplh mkd')).toBeLessThan(0.5);
  });

  it('shannon entropy: flat = 0, diverse > 0', () => {
    expect(shannon('aaaaaaaa')).toBe(0);
    expect(shannon('abcdefgh')).toBeGreaterThan(2.9);
  });

  it('IC: English band vs random-band', () => {
    expect(indexOfCoincidence('THE CAT WAS ON THE MAT WHEN THE RAT RAN FROM THE CAT AND THE DOG CHASED THE RAT THROUGH THE HOUSE AT NIGHT')).toBeGreaterThan(0.05);
    expect(indexOfCoincidence('QZXJVBKWDLPFGMCHRTYUIOASENQZXJVBKWDLPFGMCHRTYUIOASENQZXJVBKWDPFG')).toBeLessThan(0.05);
  });

  it('profile reports sane numbers', () => {
    const p = profile('hello world');
    expect(p.chars).toBe(11);
    expect(p.printableRatio).toBe(1);
    expect(p.letterRatio).toBeGreaterThan(0.8);
  });
});

describe('analyze — byte-shape encodings', () => {
  it('identifies hex of readable text and decodes it', async () => {
    const hits = await analyze('6d 65 65 74 20 6d 65 20 61 74 20 64 61 77 6e');
    expect(hits[0].id).toBe('hex-text');
    expect(hits[0].decoded).toBe('meet me at dawn');
    expect(hits[0].confidence).toBeGreaterThan(0.65);
  });

  it('identifies binary byte groups', async () => {
    const bits = Array.from('the plan is set', (c) => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
    const hits = await analyze(bits);
    expect(hits.some((h) => h.id === 'binary-8')).toBe(true);
    expect(hits.find((h) => h.id === 'binary-8')!.decoded).toBe('the plan is set');
  });

  it('identifies Base64 and Base64URL', async () => {
    const hits = await analyze(btoa('the shipment arrives saturday'));
    expect(hits[0].label).toMatch(/Base64/);
    expect(hits[0].decoded).toBe('the shipment arrives saturday');
  });

  it('identifies Base32 with padding', async () => {
    // base32 of 'hello world' computed with the same alphabet
    const alph = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const txt = new TextEncoder().encode('hello world');
    let b32str = '';
    let acc = 0, bits = 0;
    for (const byte of txt) {
      acc = (acc << 8) | byte;
      bits += 8;
      while (bits >= 5) { b32str += alph[(acc >>> (bits - 5)) & 31]; bits -= 5; }
    }
    if (bits > 0) b32str += alph[(acc << (5 - bits)) & 31];
    while (b32str.length % 8 !== 0) b32str += '=';
    const hits = await analyze(b32str);
    const b32 = hits.find((h) => h.id === 'base32');
    expect(b32).toBeDefined();
    expect(b32!.decoded).toBe('hello world');
  });

  it('identifies a 64-hex string as a hash digest (one-way)', async () => {
    const hits = await analyze('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    const h = hits.find((x) => x.id === 'hashlen-64');
    expect(h).toBeDefined();
    expect(h!.oneWay).toBe(true);
    expect(h!.decoded).toBeUndefined();
    expect(h!.label).toContain('SHA-256');
  });

  it('identifies percent-encoding and entities', async () => {
    const pct = await analyze('%74%68%65%20%63%61%63%68%65%20%69%73%20%6d%69%6e%65');
    expect(pct[0].id).toBe('percent');
    expect(pct[0].decoded).toBe('the cache is mine');
    const ent = await analyze('&#104;&#105;&#100;&#100;&#101;&#110;&#32;&#116;&#111;&#119;&#101;&#114;');
    expect(ent.some((h) => h.id === 'html-entities')).toBe(true);
    expect(ent.find((h) => h.id === 'html-entities')!.decoded).toBe('hidden tower');
  });
});

describe('analyze — codes', () => {
  it('decodes morse first', async () => {
    const hits = await analyze('-.-. --- -.. . / ... .. --. -. .- .-..');
    expect(hits[0].id).toBe('morse');
    expect(hits[0].decoded).toBe('CODE SIGNAL');
  });

  it('decodes A1Z26 coordinates', async () => {
    const hits = await analyze('8 5 12 12 15 23 15 18 12 4');
    const a = hits.find((h) => h.id === 'a1z26');
    expect(a).toBeDefined();
    expect(a!.decoded).toBe('helloworld');
  });

  it('decodes tap code pairs', async () => {
    const hits = await analyze('23 15 31 31 34');
    const tap = hits.find((h) => h.id === 'tap-code');
    expect(tap).toBeDefined();
    expect(tap!.decoded).toBe('hello');
  });

  it('decodes braille unicode', async () => {
    const hits = await analyze('⠓⠑⠇⠇⠕');
    const b = hits.find((h) => h.id === 'braille');
    expect(b).toBeDefined();
    expect(b!.decoded).toBe('hello');
    expect(b!.confidence).toBeGreaterThan(0.7);
  });

  it('decodes emoji cipherskin with the correct theme', async () => {
    const skin = emojiEncode('the vault opens friday', 'animals');
    const hits = await analyze(skin);
    expect(hits[0].id).toBe('emoji-skin');
    expect(hits[0].decoded).toBe('the vault opens friday');
  });

  it('decodes semaphore clock pairs', async () => {
    // H=(2,3) E=(1,6) L=(2,6) L=(2,6) O=(3,4)
    const hits = await analyze('2-3 1-6 2-6 2-6 3-4');
    const s = hits.find((h) => h.id === 'semaphore');
    expect(s).toBeDefined();
    expect(s!.decoded).toBe('HELLO');
  });
});

describe('analyze — secrets & signatures', () => {
  it('flags invisible ink with confidence 1', async () => {
    const masked = inkEncode('totally normal text', 'launch codes: 77-baker');
    const hits = await analyze(masked);
    expect(hits[0].id).toBe('invisible-ink');
    expect(hits[0].confidence).toBe(1);
    expect(hits[0].decoded).toBe('launch codes: 77-baker');
    expect(hits[0].family).toBe('secret');
  });

  it('recognizes VK1 locker blobs as needsKey', async () => {
    const hits = await analyze('VK1.Z2RpbmQ.aXYxMjM0.dGhpc2lzZW5j');
    expect(hits[0].id).toBe('vk1');
    expect(hits[0].needsKey).toBe(true);
    expect(hits[0].confidence).toBe(1);
  });

  it('recognizes timelocked VK1.T with grind note', async () => {
    const hits = await analyze('VK1.T.a1b2c3d4e5f60718293a4b5c6d7e8f90.15000.c2FsdGl0.aXYxMg.ct');
    expect(hits[0].id).toBe('vk1-tl');
    expect(hits[0].label).toContain('Timelocked');
    expect(hits[0].needsKey).toBe(true);
  });

  it('recognizes a JWT and decodes header + payload', async () => {
    const hits = await analyze('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJuYW1lIjoiS3J5cHRhIn0.dummySignature');
    const jwt = hits.find((h) => h.id === 'jwt');
    expect(jwt).toBeDefined();
    expect(jwt!.decoded).toContain('HS256');
    expect(jwt!.decoded).toContain('Krypta');
  });

  it('recognizes data URIs', async () => {
    const hits = await analyze('data:text/plain;base64,' + btoa('peekaboo'));
    expect(hits[0].id).toBe('data-uri');
    expect(hits[0].decoded).toBe('peekaboo');
  });
});

describe('analyze — classical ciphers', () => {
  it('breaks a Caesar shift and ranks it high', async () => {
    const hits = await analyze('wklv lv d vhfuhw phvvdjh klgghq zlwk d vlpsoh vkliw ri wkuhh ohwwhuv hdfk');
    const c = hits.find((h) => h.id === 'caesar');
    expect(c).toBeDefined();
    expect(c!.decoded!.toLowerCase()).toContain('secret message');
    expect(c!.decoded!.toLowerCase()).toContain('simple shift of three');
  });

  it('names ROT13 explicitly when the shift is 13', async () => {
    const hits = await analyze('uryyb jbeyq guvf vf n fcbvyre uvqq va gur ivrj');
    const c = hits[0];
    expect(c.label).toContain('ROT13');
    expect(c.decoded!.toLowerCase()).toContain('hello world');
  });

  it('flags vigenère-like ciphertext with low IC', async () => {
    const hits = await analyze(
      'LIVVSC LRFQATZRGJR DELAVQQW GWRPKVUTCZ PPFLRWBQGL BLOFXXUTXZ QYETVGCKGT VZXJMLSJIE KTMFLJZWKN USAWDZPPOI QMQBLSDRVZ RQHZLXKCO',);
    const v = hits.find((h) => h.id === 'vigenere-hint');
    expect(v).toBeDefined();
    expect(v!.opId).toBe('vigenere-breaker');
  });

  it('returns an undetermined hit for nonsense instead of crashing', async () => {
    const hits = await analyze('###!!!???@@@~~~ ^^^ $$$');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].family).toBe('unknown');
  });

  it('identifies plain English as-is (caesar shift 0 fallback never ranks above a real read)', async () => {
    const hits = await analyze('this is just a completely normal sentence that someone pasted in by mistake');
    // Either nothing screams transformation, or the top hit notes it reads as English.
    expect(hits.length === 0 || hits[0].family === 'unknown' || hits[0].label.includes('Plain')).toBe(true);
  });
});
