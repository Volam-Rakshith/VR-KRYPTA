// Classical ciphers: historical, educational systems. Every cipher here is
// breakable — none provides modern security, and the UI says so.
import { defineOp } from './core/registry';
import { textValue } from './core/types';
import { onlyLetters } from '../utils/bytes';

const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Shift letters, preserve everything else exactly (case-insensitive -> upper). */
function shiftLetters(text: string, shift: (ch: string, i: number, letterIndex: number) => string | null): string {
  let letterIndex = 0;
  let out = '';
  for (const raw of text) {
    const ch = raw.toUpperCase();
    if (ch >= 'A' && ch <= 'Z') {
      out += shift(ch, out.length, letterIndex);
      letterIndex++;
    } else out += raw;
  }
  return out;
}

const warnClassical = 'Classical ciphers are educational systems, trivially broken with modern analysis — never use them for real secrecy.';

function monoCipher(opts: {
  id: string; name: string; historicalName?: string; description: string;
  aliases?: string[]; tags?: string[];
  map: (ch: string, dir: 1 | -1) => string;
  encLabel?: string; decLabel?: string;
  example?: string; docs?: string;
}) {
  defineOp({
    id: opts.id,
    name: opts.name,
    category: 'ciphers',
    historicalName: opts.historicalName,
    description: opts.description,
    aliases: opts.aliases,
    tags: opts.tags,
    input: 'text',
    output: 'text',
    reversible: true,
    engine: 'typescript',
    actions: [
      { id: 'encipher', label: opts.encLabel ?? 'Encipher', kind: 'transform', run: (v) => textValue(shiftLetters(v.text, (ch) => opts.map(ch, 1))) },
      { id: 'decipher', label: opts.decLabel ?? 'Decipher', kind: 'transform', run: (v) => textValue(shiftLetters(v.text, (ch) => opts.map(ch, -1))) }
    ],
    examples: opts.example ? [{ label: 'Try it', input: opts.example }] : undefined,
    warnings: [warnClassical],
    docs: opts.docs
  });
}

/* ------------------------------- CAESAR / ROT ------------------------------ */

defineOp({
  id: 'caesar',
  name: 'Caesar Cipher',
  category: 'ciphers',
  historicalName: 'Caesar shift (Roman era)',
  description: 'Monoalphabetic shift: every letter moves a fixed number of positions through the alphabet.',
  aliases: ['caesar shift', 'shift cipher', 'rot cipher', 'rotation'],
  tags: ['cipher', 'classical', 'substitution', 'caesar'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'typescript',
  options: [
    { type: 'number', key: 'shift', label: 'Shift', default: 3, min: 1, max: 25, help: 'Caesar famously used 3. ROT13 is shift 13.' },
    { type: 'toggle', key: 'keepForeign', label: 'Preserve non-letters', default: true }
  ],
  actions: [
    { id: 'encipher', label: 'Encipher', kind: 'transform', run: (v, o) => textValue(shiftLetters(v.text, (ch) => AZ[(AZ.indexOf(ch) + Number(o.shift ?? 3)) % 26])) },
    { id: 'decipher', label: 'Decipher', kind: 'transform', run: (v, o) => textValue(shiftLetters(v.text, (ch) => AZ[(AZ.indexOf(ch) - Number(o.shift ?? 3) + 26) % 26])) }
  ],
  examples: [{ label: 'Caesar\'s 3-shift', input: 'VENI VIDI VICI', options: { shift: 3 } }],
  warnings: [warnClassical],
  docs: 'Punctuation, digits and spaces pass through unchanged — nothing is silently dropped.'
});

defineOp({
  id: 'rot13',
  name: 'ROT13',
  category: 'ciphers',
  description: 'The self-inverse Caesar shift of 13. Applying ROT13 twice restores the input — classic spoiler-hider.',
  aliases: ['rot-13', 'rotate 13'],
  tags: ['cipher', 'classical', 'caesar', 'spoiler'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'typescript',
  actions: [
    {
      id: 'apply', label: 'Apply ROT13', kind: 'transform',
      run: (v) => textValue(shiftLetters(v.text, (ch) => {
        const i = AZ.indexOf(ch);
        return AZ[(i + 13) % 26];
      }))
    }
  ],
  examples: [{ label: 'Spoiler', input: 'URYYB JBEYQ' }],
  warnings: [warnClassical],
  docs: 'One action only: ROT13 is its own inverse.'
});

monoCipher({
  id: 'atbash',
  name: 'Atbash Cipher',
  historicalName: 'Atbash (Hebrew alphabet origin)',
  description: 'Ancient mirror cipher: A↔Z, B↔Y … each letter maps to its reflection in the alphabet.',
  aliases: ['atbasz', 'mirror cipher', 'reverse alphabet'],
  tags: ['cipher', 'classical', 'substitution', 'ancient'],
  map: (ch) => AZ[25 - AZ.indexOf(ch)],
  encLabel: 'Apply Atbash',
  decLabel: 'Apply Atbash',
  example: 'GSVIVZMWLMGL',
  docs: 'Atbash is self-inverse: one action labelled for both directions.'
});

/* --------------------------------- AFFINE --------------------------------- */

function modInverse(a: number, m: number): number | null {
  a = ((a % m) + m) % m;
  for (let x = 1; x < m; x++) if ((a * x) % m === 1) return x;
  return null;
}

function validateAffine(a: number, b: number) {
  if (!Number.isInteger(a) || !Number.isInteger(b)) throw new Error('a and b must be integers.');
  if (modInverse(a, 26) === null) throw new Error(`a = ${a} is not coprime with 26 — no inverse exists. Valid a: 1, 3, 5, 7, 9, 11, 15, 17, 19, 21, 23, 25.`);
  if (b < 0 || b > 25) throw new Error('b must be in 0–25.');
}

defineOp({
  id: 'affine',
  name: 'Affine Cipher',
  category: 'ciphers',
  description: 'Algebraic monoalphabetic cipher: C = (a·P + b) mod 26. The multiplier a must be coprime with 26.',
  aliases: ['affine'],
  tags: ['cipher', 'classical', 'math', 'substitution'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'typescript',
  options: [
    { type: 'number', key: 'a', label: 'Multiplier a (coprime with 26)', default: 5, min: 1, max: 25 },
    { type: 'number', key: 'b', label: 'Shift b', default: 8, min: 0, max: 25 }
  ],
  actions: [
    {
      id: 'encipher', label: 'Encipher', kind: 'transform',
      run: (v, o) => {
        const a = Number(o.a), b = Number(o.b);
        validateAffine(a, b);
        return textValue(shiftLetters(v.text, (ch) => AZ[(a * AZ.indexOf(ch) + b) % 26]));
      }
    },
    {
      id: 'decipher', label: 'Decipher', kind: 'transform',
      run: (v, o) => {
        const a = Number(o.a), b = Number(o.b);
        validateAffine(a, b);
        const inv = modInverse(a, 26)!;
        return textValue(shiftLetters(v.text, (ch) => AZ[((inv * (AZ.indexOf(ch) - b)) % 26 + 26) % 26]));
      }
    }
  ],
  examples: [{ label: 'a=5 b=8', input: 'AFFINE CIPHER', options: { a: 5, b: 8 } }],
  warnings: [warnClassical]
});

/* ------------------------------ POLYALPHABETIC ----------------------------- */

function keyedLetters(key: string, label = 'Key'): string {
  const k = onlyLetters(key);
  if (!k) throw new Error(`${label} must contain at least one letter A–Z.`);
  return k;
}

function polyRun(text: string, key: string, fn: (p: number, k: number) => number): string {
  const k = keyedLetters(key);
  let out = '';
  let i = 0;
  for (const raw of text) {
    const ch = raw.toUpperCase();
    if (ch >= 'A' && ch <= 'Z') {
      out += AZ[fn(AZ.indexOf(ch), AZ.indexOf(k[i % k.length]))];
      i++;
    } else out += raw;
  }
  return out;
}

function polyCipher(cfg: {
  id: string; name: string; desc: string; aliases?: string[]; tags?: string[];
  enc: (p: number, k: number) => number; dec: (p: number, k: number) => number;
  keyLabel?: string; example?: { input: string; key: string }; docs?: string;
}) {
  defineOp({
    id: cfg.id,
    name: cfg.name,
    category: 'ciphers',
    description: cfg.desc,
    aliases: cfg.aliases,
    tags: cfg.tags,
    input: 'text',
    output: 'text',
    reversible: true,
    engine: 'typescript',
    options: [{ type: 'text', key: 'key', label: cfg.keyLabel ?? 'Key word', default: cfg.example?.key ?? 'KEY' }],
    actions: [
      { id: 'encipher', label: 'Encipher', kind: 'transform', run: (v, o) => textValue(polyRun(v.text, String(o.key ?? ''), cfg.enc)) },
      { id: 'decipher', label: 'Decipher', kind: 'transform', run: (v, o) => textValue(polyRun(v.text, String(o.key ?? ''), cfg.dec)) }
    ],
    examples: cfg.example ? [{ label: `Key “${cfg.example.key}”`, input: cfg.example.input, options: { key: cfg.example.key } }] : undefined,
    warnings: [warnClassical],
    docs: cfg.docs
  });
}

polyCipher({
  id: 'vigenere',
  name: 'Vigenère Cipher',
  desc: 'Polyalphabetic cipher: each plaintext letter is shifted by the corresponding key letter (tabula recta).',
  aliases: ['vigenere', 'le chiffre indéchiffrable'],
  tags: ['cipher', 'classical', 'polyalphabetic'],
  enc: (p, k) => (p + k) % 26,
  dec: (c, k) => ((c - k + 26) % 26),
  example: { input: 'ATTACKATDAWN', key: 'LEMON' },
  docs: 'Resists simple frequency analysis but falls to Kasiski examination / index-of-coincidence key-length attacks.'
});

polyCipher({
  id: 'beaufort',
  name: 'Beaufort Cipher',
  desc: 'Reciprocal polyalphabetic cipher: C = (K − P) mod 26. Enciphering and deciphering are the same operation.',
  aliases: ['beaufort', 'sir francis beaufort'],
  tags: ['cipher', 'classical', 'polyalphabetic', 'reciprocal'],
  enc: (p, k) => ((k - p + 26) % 26),
  dec: (c, k) => ((k - c + 26) % 26),
  example: { input: 'DEFENDTHEEASTWALL', key: 'FORTIFICATION' },
  docs: 'Unlike Vigenère, Beaufort is reciprocal: running the same action again reverses it.'
});

polyCipher({
  id: 'variant-beaufort',
  name: 'Variant Beaufort Cipher',
  desc: 'The inverse-glyph sibling of Beaufort: C = (P − K) mod 26. Encipher here equals Vigenère-decipher and vice versa.',
  aliases: ['variant beaufort'],
  tags: ['cipher', 'classical', 'polyalphabetic'],
  enc: (p, k) => ((p - k + 26) % 26),
  dec: (c, k) => ((k - c + 26) % 26),
  example: { input: 'DEFENDTHEEASTWALL', key: 'FORTIFICATION' },
  docs: 'Variant Beaufort is NOT reciprocal — it is the inverse of Beaufort, which is why all three variants are exposed separately.'
});

/* -------------------------------- GRONSFELD ------------------------------- */

defineOp({
  id: 'gronsfeld',
  name: 'Gronsfeld Cipher',
  category: 'ciphers',
  description: 'Vigenère restricted to a numeric key: each key digit (0–9) is the shift for its position.',
  aliases: ['gronsfeld', 'numeric vigenere'],
  tags: ['cipher', 'classical', 'polyalphabetic'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'typescript',
  options: [{ type: 'text', key: 'key', label: 'Key digits (e.g. 31415)', default: '31415' }],
  actions: [
    ...[1, -1].map((dir) => ({
      id: dir === 1 ? 'encipher' : 'decipher',
      label: dir === 1 ? 'Encipher' : 'Decipher',
      kind: 'transform' as const,
      run: (v: { text: string }, o: Record<string, unknown>) => {
        const key = String(o.key ?? '').replace(/[^0-9]/g, '');
        if (!key) throw new Error('Gronsfeld key must contain at least one digit 0–9.');
        let out = '', i = 0;
        for (const raw of v.text) {
          const ch = raw.toUpperCase();
          if (ch >= 'A' && ch <= 'Z') {
            const k = Number(key[i % key.length]);
            out += AZ[(AZ.indexOf(ch) + dir * k + 26) % 26];
            i++;
          } else out += raw;
        }
        return textValue(out);
      }
    }))
  ],
  examples: [{ label: 'Key 31415', input: 'ATTACKATDAWN', options: { key: '31415' } }],
  warnings: [warnClassical],
  docs: 'Only 10 distinct shifts exist, making Gronsfeld strictly weaker than Vigenère.'
});

/* --------------------------------- AUTOKEY -------------------------------- */

defineOp({
  id: 'autokey',
  name: 'Autokey Cipher',
  category: 'ciphers',
  description: 'Vigenère with the key extended by the plaintext itself (encryption) — defeats repeated-key attacks but leaks structure.',
  aliases: ['autokey vigenere', 'auto-clave'],
  tags: ['cipher', 'classical', 'polyalphabetic'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'typescript',
  options: [{ type: 'text', key: 'key', label: 'Primer key word', default: 'QUEENLY' }],
  actions: [
    {
      id: 'encipher', label: 'Encipher', kind: 'transform',
      run: (v, o) => {
        const primer = keyedLetters(String(o.key ?? ''));
        const letters = onlyLetters(v.text);
        if (!letters) return textValue(v.text);
        const stream = (primer + letters).slice(0, letters.length);
        let out = '', i = 0;
        for (const raw of v.text) {
          const ch = raw.toUpperCase();
          if (ch >= 'A' && ch <= 'Z') {
            out += AZ[(AZ.indexOf(ch) + AZ.indexOf(stream[i++])) % 26];
          } else out += raw;
        }
        return textValue(out);
      }
    },
    {
      id: 'decipher', label: 'Decipher', kind: 'transform',
      run: (v, o) => {
        const primer = keyedLetters(String(o.key ?? ''));
        let stream = primer;
        let out = '', i = 0;
        for (const raw of v.text) {
          const ch = raw.toUpperCase();
          if (ch >= 'A' && ch <= 'Z') {
            const p = (AZ.indexOf(ch) - AZ.indexOf(stream[i]) + 26) % 26;
            stream += AZ[p];
            out += AZ[p];
            i++;
          } else out += raw;
        }
        return textValue(out);
      }
    }
  ],
  examples: [{ label: 'Primer QUEENLY', input: 'ATTACKATDAWN', options: { key: 'QUEENLY' } }],
  warnings: [warnClassical]
});

/* ---------------------------------- PORTA --------------------------------- */

defineOp({
  id: 'porta',
  name: 'Porta Cipher',
  category: 'ciphers',
  historicalName: 'Giovanni Battista della Porta (1563)',
  description: 'Reciprocal polyalphabetic cipher over 13 key-letter pairs — each pair defines one of 13 reciprocal swap tables.',
  aliases: ['della porta', 'porta table'],
  tags: ['cipher', 'classical', 'polyalphabetic', 'reciprocal', 'historical'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'typescript',
  options: [{ type: 'text', key: 'key', label: 'Key word', default: 'PORTA' }],
  actions: [
    {
      id: 'apply', label: 'Apply (reciprocal)', kind: 'transform',
      run: (v, o) => {
        const key = keyedLetters(String(o.key ?? ''));
        let out = '', i = 0;
        for (const raw of v.text) {
          const ch = raw.toUpperCase();
          if (!(ch >= 'A' && ch <= 'Z')) { out += raw; continue; }
          const p = Math.floor(AZ.indexOf(key[i % key.length]) / 2);
          const x = AZ.indexOf(ch);
          out += x < 13
            ? String.fromCharCode(65 + 13 + ((x + p) % 13))
            : String.fromCharCode(65 + (((x - 13 - p) % 13 + 13) % 13));
          i++;
        }
        return textValue(out);
      }
    }
  ],
  examples: [{ label: 'Key PORTA', input: 'DEFENDTHEEASTWALL', options: { key: 'PORTA' } }],
  warnings: [warnClassical],
  docs: 'Key letters collapse to 13 pairs (A/B → table 0, C/D → table 1 …). Porta is reciprocal: one action runs both directions.'
});

/* --------------------------------- PLAYFAIR -------------------------------- */

function playfairSquare(key: string): string {
  const base = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';
  let sq = '';
  for (const ch of (key.toUpperCase().replace(/J/g, 'I') + base)) if (base.includes(ch) && !sq.includes(ch)) sq += ch;
  return sq;
}

function playfairPairs(text: string): string[] {
  const letters = onlyLetters(text).replace(/J/g, 'I');
  const pairs: string[] = [];
  let i = 0;
  while (i < letters.length) {
    const a = letters[i];
    const b = letters[i + 1];
    if (!b) { pairs.push(a + 'X'); i++; }
    else if (a === b) { pairs.push(a + 'X'); i++; }
    else { pairs.push(a + b); i += 2; }
  }
  return pairs;
}

function playfairRun(text: string, key: string, dir: 1 | -1): string {
  const sq = playfairSquare(key);
  const pos = (ch: string) => { const i = sq.indexOf(ch); return [Math.floor(i / 5), i % 5]; };
  return playfairPairs(text).map((pair) => {
    const [r1, c1] = pos(pair[0]);
    const [r2, c2] = pos(pair[1]);
    let a = '', b = '';
    if (r1 === r2) {
      a = sq[r1 * 5 + (c1 + dir + 5) % 5];
      b = sq[r2 * 5 + (c2 + dir + 5) % 5];
    } else if (c1 === c2) {
      a = sq[((r1 + dir + 5) % 5) * 5 + c1];
      b = sq[((r2 + dir + 5) % 5) * 5 + c2];
    } else {
      a = sq[r1 * 5 + c2];
      b = sq[r2 * 5 + c1];
    }
    return a + b;
  }).join(' ');
}

defineOp({
  id: 'playfair',
  name: 'Playfair Cipher',
  category: 'ciphers',
  historicalName: 'Playfair (Charles Wheatstone, 1854)',
  description: 'Digraph substitution on a keyed 5×5 square: rows shift, columns drop, rectangles swap corners.',
  aliases: ['playfair square', 'wheatstone cipher'],
  tags: ['cipher', 'classical', 'digraph', 'square'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'typescript',
  options: [
    { type: 'text', key: 'key', label: 'Key phrase', default: 'PLAYFAIR' },
    { type: 'toggle', key: 'stripPadding', label: 'Strip obvious X/Q padding when deciphering', default: true }
  ],
  actions: [
    { id: 'encipher', label: 'Encipher', kind: 'transform', run: (v, o) => textValue(playfairRun(v.text, String(o.key ?? ''), 1)) },
    {
      id: 'decipher', label: 'Decipher', kind: 'transform',
      run: (v, o) => {
        let out = playfairRun(v.text, String(o.key ?? ''), -1).replace(/ /g, '');
        if (o.stripPadding) {
          let cleaned = '';
          for (let i = 0; i < out.length - 1; i++) {
            cleaned += out[i];
            if ((out[i + 1] === 'X' || out[i + 1] === 'Q') && i + 2 < out.length && out[i] === out[i + 2]) i++;
          }
          cleaned += out.slice(-1);
          if (cleaned.endsWith('X') || cleaned.endsWith('Q')) cleaned = cleaned.slice(0, -1);
          out = cleaned;
        }
        return textValue(out);
      }
    }
  ],
  examples: [{ label: 'Wheatstone demo', input: 'HIDETHEGOLDINTHETREESTUMP', options: { key: 'PLAYFAIR' } }],
  warnings: [warnClassical],
  docs: 'J merges into I. Doubled letters are split with an X pad, and a trailing X pads odd lengths — deciphered output keeps any genuine X/Q letters.'
});

/* ------------------------------ TRANSPOSITION ----------------------------- */

defineOp({
  id: 'rail-fence',
  name: 'Rail Fence Cipher',
  category: 'ciphers',
  description: 'Zigzag transposition: text written along rails in a W-pattern, then read rail by rail.',
  aliases: ['zigzag cipher', 'railfence'],
  tags: ['cipher', 'classical', 'transposition'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'typescript',
  options: [{ type: 'number', key: 'rails', label: 'Rails', default: 3, min: 2, max: 10 }],
  actions: [
    {
      id: 'encipher', label: 'Encipher', kind: 'transform',
      run: (v, o) => {
        const rails = Math.max(2, Number(o.rails ?? 3));
        const fence: string[][] = Array.from({ length: rails }, () => []);
        let r = 0, dir = 1;
        for (const ch of v.text) {
          fence[r].push(ch);
          if (r === 0) dir = 1;
          if (r === rails - 1) dir = -1;
          r += dir;
        }
        return textValue(fence.map((row) => row.join('')).join(''));
      }
    },
    {
      id: 'decipher', label: 'Decipher', kind: 'transform',
      run: (v, o) => {
        const rails = Math.max(2, Number(o.rails ?? 3));
        const text = v.text;
        const pattern: number[] = [];
        let r = 0, dir = 1;
        for (let i = 0; i < text.length; i++) {
          pattern.push(r);
          if (r === 0) dir = 1;
          if (r === rails - 1) dir = -1;
          r += dir;
        }
        const counts = Array.from({ length: rails }, (_, rail) => pattern.filter((x) => x === rail).length);
        const rows: string[][] = [];
        let ptr = 0;
        for (const c of counts) { rows.push(text.slice(ptr, ptr + c).split('')); ptr += c; }
        const rowPtr = Array(rails).fill(0);
        return textValue(pattern.map((rail) => rows[rail][rowPtr[rail]++]).join(''));
      }
    }
  ],
  examples: [{ label: '3 rails', input: 'DEFENDTHEEASTWALL', options: { rails: 3 } }],
  warnings: [warnClassical],
  docs: 'This implementation transposes the raw input exactly — spaces and punctuation ride the rails too and are restored on deciphering. Classical puzzle texts are usually written without spaces first.'
});

defineOp({
  id: 'scytale',
  name: 'Scytale Cipher',
  category: 'ciphers',
  historicalName: 'Scytale (Sparta, ~5th c. BC)',
  description: 'The rod transposition: text wraps around a cylinder of a given “diameter” (row count) and is read along its length.',
  aliases: ['skytale', 'spartan cipher'],
  tags: ['cipher', 'classical', 'transposition', 'ancient'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'typescript',
  options: [{ type: 'number', key: 'diameter', label: 'Diameter (rows)', default: 4, min: 2, max: 20 }],
  actions: [
    {
      id: 'encipher', label: 'Encipher', kind: 'transform',
      run: (v, o) => {
        const rows = Math.max(2, Number(o.diameter ?? 4));
        const cols = Math.ceil(v.text.length / rows);
        let out = '';
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const ch = v.text[c * rows + r];
          if (ch !== undefined) out += ch;
        }
        return textValue(out);
      }
    },
    {
      id: 'decipher', label: 'Decipher', kind: 'transform',
      run: (v, o) => {
        const rows = Math.max(2, Number(o.diameter ?? 4));
        const cols = Math.ceil(v.text.length / rows);
        const grid: string[][] = Array.from({ length: cols }, () => Array(rows).fill(''));
        let i = 0;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (c * rows + r < v.text.length) grid[c][r] = v.text[i++];
        return textValue(grid.map((col) => col.join('')).join(''));
      }
    }
  ],
  examples: [{ label: 'Spartan', input: 'IAMHURTVERYBADLYHELP', options: { diameter: 5 } }],
  warnings: [warnClassical]
});

defineOp({
  id: 'columnar-transposition',
  name: 'Columnar Transposition',
  category: 'ciphers',
  description: 'Text written in rows under a keyword, then read column by column in alphabetical keyword order.',
  aliases: ['columnar cipher', 'keyword transposition'],
  tags: ['cipher', 'classical', 'transposition'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'typescript',
  options: [
    { type: 'text', key: 'key', label: 'Keyword', default: 'KRYPTA' },
    { type: 'select', key: 'padding', label: 'Padding fill', default: 'random', options: [
      { value: 'random', label: 'Random letters (classic)' },
      { value: 'x', label: 'Fixed X' }
    ] }
  ],
  actions: [
    {
      id: 'encipher', label: 'Encipher', kind: 'transform',
      run: (v, o) => {
        const key = keyedLetters(String(o.key ?? ''));
        const text = onlyLetters(v.text);
        if (text.length < key.length) throw new Error('Input must be at least as long as the keyword.');
        const order = [...key].map((ch, i) => ({ ch, i })).sort((a, b) => a.ch.localeCompare(b.ch) || a.i - b.i).map((x) => x.i);
        const cols = key.length;
        const rows = Math.ceil(text.length / cols);
        const padded = text + (String(o.padding) === 'x'
          ? 'X'.repeat(rows * cols - text.length)
          : Array.from({ length: rows * cols - text.length }, () => AZ[Math.floor(Math.random() * 26)]).join(''));
        let out = '';
        for (const col of order) for (let r = 0; r < rows; r++) out += padded[r * cols + col];
        return textValue(out);
      }
    },
    {
      id: 'decipher', label: 'Decipher', kind: 'transform',
      run: (v, o) => {
        const key = keyedLetters(String(o.key ?? ''));
        const clean = v.text.replace(/\s+/g, '');
        const cols = key.length;
        if (clean.length % cols !== 0) throw new Error(`Ciphertext length (${clean.length}) must be a multiple of the keyword length (${cols}).`);
        const rows = clean.length / cols;
        const order = [...key].map((ch, i) => ({ ch, i })).sort((a, b) => a.ch.localeCompare(b.ch) || a.i - b.i).map((x) => x.i);
        const colData = new Map<number, string>();
        let ptr = 0;
        for (const col of order) { colData.set(col, clean.slice(ptr, ptr + rows)); ptr += rows; }
        let out = '';
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out += colData.get(c)![r];
        return textValue(out);
      }
    }
  ],
  examples: [{ label: 'Keyword KRYPTA', input: 'TRANSPOSEEVERYLETTERAROUND', options: { key: 'KRYPTA' } }],
  warnings: [warnClassical],
  docs: 'Classic padding uses random letters, so deciphered output may end in filler characters — that tail is the padding, not corruption.'
});

/* ----------------------------- KEYBOARD / CUSTOM --------------------------- */

const KB_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

defineOp({
  id: 'keyboard-shift',
  name: 'Keyboard Shift Cipher',
  category: 'ciphers',
  description: 'Each letter is replaced by the key N positions left or right on a QWERTY keyboard — the “wrong finger” cipher.',
  aliases: ['keyboard cipher', 'keyboard layout shift', 'qwerty shift', 'finger slip'],
  tags: ['cipher', 'keyboard', 'puzzle', 'substitution'],
  input: 'text',
  output: 'text',
  reversible: true,
  lossy: false,
  engine: 'typescript',
  options: [
    { type: 'number', key: 'steps', label: 'Steps', default: 1, min: 1, max: 5 },
    { type: 'select', key: 'direction', label: 'Encipher towards', default: 'right', options: [
      { value: 'right', label: 'Right (A → S)' },
      { value: 'left', label: 'Left (A ← S; S → A)' }
    ] }
  ],
  actions: [
    {
      id: 'encipher', label: 'Encipher', kind: 'transform',
      run: (v, o) => {
        const steps = Math.max(1, Number(o.steps ?? 1));
        const dir = String(o.direction) === 'left' ? -1 : 1;
        return textValue(v.text.split('').map((raw) => {
          const ch = raw.toUpperCase();
          for (const row of KB_ROWS) {
            const i = row.indexOf(ch);
            if (i >= 0) {
              const j = ((i + dir * steps) % row.length + row.length) % row.length;
              return raw === ch ? row[j] : row[j].toLowerCase();
            }
          }
          return raw;
        }).join(''));
      }
    },
    {
      id: 'decipher', label: 'Decipher', kind: 'transform',
      run: (v, o) => {
        const steps = Math.max(1, Number(o.steps ?? 1));
        const dir = String(o.direction) === 'left' ? 1 : -1;
        return textValue(v.text.split('').map((raw) => {
          const ch = raw.toUpperCase();
          for (const row of KB_ROWS) {
            const i = row.indexOf(ch);
            if (i >= 0) {
              const j = ((i + dir * steps) % row.length + row.length) % row.length;
              return raw === ch ? row[j] : row[j].toLowerCase();
            }
          }
          return raw;
        }).join(''));
      }
    }
  ],
  examples: [{ label: 'Slipped fingers', input: 'HELLO' }],
  docs: 'Rows wrap at their edges: shifting A one step left lands on P. Digits, symbols and case styling are preserved.',
  warnings: [warnClassical]
});

defineOp({
  id: 'simple-substitution',
  name: 'Simple Substitution Cipher',
  category: 'ciphers',
  description: 'Fully custom monoalphabetic mapping: supply a 26-letter cipher alphabet (or a keyword to build one).',
  aliases: ['substitution cipher', 'monoalphabetic', 'aristocrat'],
  tags: ['cipher', 'classical', 'substitution', 'custom'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'typescript',
  options: [
    { type: 'text', key: 'alphabet', label: 'Cipher alphabet or keyword', default: 'PHQGIUMEAYLNOFDXJKRCVSTZWB',
      help: 'A full 26-letter permutation, or a keyword (remaining letters appended in order).' }
  ],
  actions: [
    ...[1, -1].map((dir) => ({
      id: dir === 1 ? 'encipher' : 'decipher',
      label: dir === 1 ? 'Encipher' : 'Decipher',
      kind: 'transform' as const,
      run: (v: { text: string }, o: Record<string, unknown>) => {
        let alpha = String(o.alphabet ?? '').toUpperCase().replace(/[^A-Z]/g, '');
        if (alpha.length < 26) {
          for (const c of AZ) if (!alpha.includes(c)) alpha += c;
        }
        if (new Set(alpha).size !== 26) throw new Error('The cipher alphabet must contain each letter A–Z exactly once.');
        const from = dir === 1 ? AZ : alpha;
        const to = dir === 1 ? alpha : AZ;
        const map = new Map([...from].map((c, i) => [c, to[i]]));
        return textValue(shiftLetters(v.text, (ch) => map.get(ch)!));
      }
    }))
  ],
  examples: [{ label: 'Atbash alphabet', input: 'MEET AT DAWN', options: { alphabet: 'ZYXWVUTSRQPONMLKJIHGFEDCBA' } }],
  warnings: [warnClassical]
});
