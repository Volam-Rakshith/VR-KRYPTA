// Codes & representations: systems that represent information in another
// alphabet or numeric form. These are codes, not ciphers — there is no key.
import { defineOp } from './core/registry';
import { textValue } from './core/types';
import { utf8, bytesToHex, hexToBytes, bytesToBinary, binaryToBytes, chunk } from '../utils/bytes';

/* ---------------------------------- MORSE --------------------------------- */

const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
  K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
  U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....',
  '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--', '/': '-..-.',
  '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-',
  '+': '.-.-.', '-': '-....-', '_': '..--.-', '"': '.-..-.', '$': '...-..-', '@': '.--.-.'
};
const MORSE_REV: Record<string, string> = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

function morseEncode(text: string, dot: string, dash: string): string {
  const bad = new Set<string>();
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  const enc = words.map((word) => {
    const letters: string[] = [];
    for (const ch of word) {
      const m = MORSE[ch];
      if (!m) {
        bad.add(ch);
        letters.push('?');
      } else letters.push(m.replace(/\./g, dot).replace(/-/g, dash));
    }
    return letters.join(' '); // 1 space between letters
  });
  if (bad.size) throw new Error(`Morse (International) has no sequence for: ${[...bad].join(' ')}`);
  return enc.join(' / '); // slash between words
}

function morseDecode(code: string, dot: string, dash: string): string {
  const norm = code
    .replace(/[._]/g, '.')
    .replace(/[–—_]/g, (c) => (c === '_' ? c : '-'))
    .replace(new RegExp(`\\${dash}`, 'g'), '-')
    .replace(new RegExp(`\\${dot}`, 'g'), '.');
  const words = norm.trim().split(/ {3,}|\t+|\/+/).filter(Boolean);
  const out: string[] = [];
  for (const word of words) {
    let w = '';
    for (const token of word.trim().split(/\s+/)) {
      const ch = MORSE_REV[token];
      if (!ch) throw new Error(`Unknown Morse sequence "${token}" — check the dot/dash symbols and spacing.`);
      w += ch;
    }
    out.push(w);
  }
  return out.join(' ');
}

defineOp({
  id: 'morse',
  name: 'Morse Code',
  category: 'codes',
  description: 'International Morse code (ITU-R M.1677-1). Letters, digits and common punctuation mapped to dot/dash sequences.',
  aliases: ['morse code', 'dit dah', 'telegraph code', 'cw'],
  tags: ['code', 'telegraph', 'signal', 'audio', 'sos'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    {
      id: 'encode', label: 'Encode', kind: 'encode',
      run: (v) => textValue(morseEncode(v.text, '.', '-'), 'encoded')
    },
    {
      id: 'decode', label: 'Decode', kind: 'decode',
      run: (v) => textValue(morseDecode(v.text, '.', '-'))
    }
  ],
  examples: [{ label: 'Distress call', input: 'SOS HELP' }],
  docs: 'Letters are separated by single spaces, words by “ / ”. The decoder also accepts legacy 3/7-space spacing and the “/” word marker. Unsupported characters are reported, never silently dropped.'
});

/* ---------------------------------- A1Z26 --------------------------------- */

defineOp({
  id: 'a1z26',
  name: 'A1Z26 Letter Numbers',
  category: 'codes',
  description: 'Maps each letter to its alphabet position (A=1 … Z=26). Non-letters are reported.',
  aliases: ['letter numbers', 'alphabet numbers', 'a1z26 cipher', 'letters to numbers'],
  tags: ['code', 'puzzle', 'numbers'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  options: [
    { type: 'select', key: 'separator', label: 'Separator', default: '-', options: [
      { value: '-', label: 'Hyphen (8-5-12-12-15)' },
      { value: ' ', label: 'Space (8 5 12 12 15)' },
      { value: ',', label: 'Comma (8,5,12,12,15)' }
    ] },
    { type: 'toggle', key: 'zeroBased', label: 'Zero-based (A=0 … Z=25)', default: false }
  ],
  actions: [
    {
      id: 'encode', label: 'Encode', kind: 'encode',
      run: (v, o) => {
        const sep = String(o.separator ?? '-');
        const base = o.zeroBased ? 0 : 1;
        const nums: string[] = [];
        const bad = new Set<string>();
        for (const ch of v.text.toUpperCase()) {
          if (/[A-Z]/.test(ch)) nums.push(String(ch.charCodeAt(0) - 65 + base));
          else if (/\s/.test(ch)) nums.push('/');
          else if (!bad.has(ch)) bad.add(ch);
        }
        if (bad.size) throw new Error(`A1Z26 only maps letters A–Z. Unsupported: ${[...bad].join(' ')}`);
        return textValue(nums.join(sep === ' ' ? ' ' : sep === ',' ? ', ' : ' - '), 'encoded');
      }
    },
    {
      id: 'decode', label: 'Decode', kind: 'decode',
      run: (v, o) => {
        const base = o.zeroBased ? 0 : 1;
        const tokens = v.text.split(/[\s,\-–—]+/).filter(Boolean);
        let out = '';
        for (const t of tokens) {
          if (t === '/') { out += ' '; continue; }
          const n = parseInt(t, 10);
          if (Number.isNaN(n)) throw new Error(`"${t}" is not a number.`);
          if (n < base || n > 25 + base) throw new Error(`${n} is outside the valid range ${base}–${25 + base}.`);
          out += String.fromCharCode(65 + n - base);
        }
        return textValue(out);
      }
    }
  ],
  examples: [{ label: 'Hello', input: 'HELLO' }]
});

/* -------------------------------- BACONIAN -------------------------------- */

function baconTable(variant: string): Record<string, string> {
  const t: Record<string, string> = {};
  const letters = variant === '24' ? 'ABCDEFGHIKLMNOPQRSTUWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  letters.split('').forEach((ch, i) => { t[ch] = i.toString(2).padStart(5, '0'); });
  if (variant === '24') { t['J'] = t['I']; t['V'] = t['U']; }
  return t;
}

defineOp({
  id: 'baconian',
  name: "Bacon's Biliteral Cipher",
  category: 'codes',
  historicalName: "Bacon's cipher (1605)",
  description: 'Francis Bacon\'s biliteral encoding: each letter becomes a 5-symbol group of two distinct symbols (classically A/B).',
  aliases: ['bacon cipher', 'baconian', 'biliteral', '5-bit binary'],
  tags: ['code', 'historical', 'steganography', 'binary'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  options: [
    { type: 'select', key: 'variant', label: 'Alphabet variant', default: '26', options: [
      { value: '26', label: '26-letter (modern, I≠J, U≠V)' },
      { value: '24', label: '24-letter (original, I=J, U=V)' }
    ], help: 'Bacon\'s 1605 alphabet merged I/J and U/V.' },
    { type: 'text', key: 'symA', label: 'Symbol for 0', default: 'A' },
    { type: 'text', key: 'symB', label: 'Symbol for 1', default: 'B' }
  ],
  actions: [
    {
      id: 'encode', label: 'Encode', kind: 'encode',
      run: (v, o) => {
        const table = baconTable(String(o.variant));
        const a = String(o.symA ?? 'A').charAt(0), b = String(o.symB ?? 'B').charAt(0);
        if (a === b) throw new Error('The two symbols must be different.');
        const out: string[] = [];
        for (const ch of v.text.toUpperCase()) {
          if (ch === ' ') { out.push('/'); continue; }
          const code = table[ch];
          if (!code) throw new Error(`Bacon's cipher covers letters only. Unsupported: "${ch}"`);
          out.push(code.replace(/0/g, a).replace(/1/g, b));
        }
        return textValue(out.join(' '), 'encoded');
      }
    },
    {
      id: 'decode', label: 'Decode', kind: 'decode',
      run: (v, o) => {
        const variant = String(o.variant ?? '26');
        const a = String(o.symA ?? 'A').charAt(0), b = String(o.symB ?? 'B').charAt(0);
        const clean = v.text.replace(/\//g, ' / ').split(/\s+/).filter(Boolean);
        const rev: Record<string, string> = {};
        for (const [ch, code] of Object.entries(baconTable(variant))) rev[code] = ch;
        let out = '';
        for (const token of clean) {
          if (token === '/') { out += ' '; continue; }
          const bits = token.split('').map((c) => (c === a ? '0' : c === b ? '1' : null));
          if (bits.some((x) => x === null) || bits.length !== 5)
            throw new Error(`Group "${token}" must be exactly 5 symbols of "${a}"/"${b}".`);
          const ch = rev[bits.join('')];
          if (!ch) throw new Error(`Group "${token}" is outside the ${variant}-letter alphabet.`);
          out += ch;
        }
        return textValue(out);
      }
    }
  ],
  examples: [{ label: 'Bacon', input: 'Bacon' }],
  docs: 'In the 24-letter variant, I/J and U/V share a code — decoding those positions resolves both to I and U by convention.'
});

/* --------------------------------- TAP CODE -------------------------------- */

defineOp({
  id: 'tap-code',
  name: 'Tap Code',
  category: 'codes',
  description: 'Polybius-square knock code used by prisoners of war: letters tapped as row,column counts on a 5×5 grid.',
  aliases: ['knock code', 'tap cipher', 'prison code'],
  tags: ['code', 'puzzle', 'historical', 'polybius'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  options: [
    { type: 'select', key: 'format', label: 'Output format', default: 'dots', options: [
      { value: 'dots', label: 'Taps (· ·, · · ·)' },
      { value: 'digits', label: 'Digit pairs (23 41)' }
    ] }
  ],
  actions: [
    {
      id: 'encode', label: 'Encode', kind: 'encode',
      run: (v, o) => {
        const grid = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';
        const parts: string[] = [];
        for (const ch of v.text.toUpperCase()) {
          if (ch === ' ') { parts.push('/'); continue; }
          let c = ch === 'C' ? 'K' : ch;
          const i = grid.indexOf(c);
          if (i < 0) throw new Error(`Tap code covers A–Z only. Unsupported: "${ch}"`);
          const r = Math.floor(i / 5) + 1, col = (i % 5) + 1;
          parts.push(String(o.format) === 'dots' ? `${'· '.repeat(r).trim()} , ${'· '.repeat(col).trim()}` : `${r}${col}`);
        }
        return textValue(parts.join(String(o.format) === 'dots' ? '  ' : ' '), 'encoded');
      }
    },
    {
      id: 'decode', label: 'Decode', kind: 'decode',
      run: (v) => {
        const grid = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';
        let out = '';
        for (const token of v.text.trim().split(/\s+/)) {
          if (token === '/') { out += ' '; continue; }
          if (!/^[1-5]{2}$/.test(token)) throw new Error(`"${token}" is not a valid tap pair — use digit pairs like 23 (row 2, column 3).`);
          out += grid[(Number(token[0]) - 1) * 5 + (Number(token[1]) - 1)];
        }
        return textValue(out);
      }
    }
  ],
  examples: [{ label: 'Water', input: 'WATER', options: { format: 'digits' } }],
  docs: 'The grid merges C and K by tradition. Encoded "C" is written as "K"; decoding pair 21 yields "K".'
});

/* ------------------------------- POLYBIUS --------------------------------- */

defineOp({
  id: 'polybius',
  name: 'Polybius Square',
  category: 'codes',
  historicalName: 'Polybius square (~150 BC)',
  description: 'Greek coordinate code: each letter is replaced by its row and column in a 5×5 (optionally keyed) square.',
  aliases: ['polybius cipher', 'polybius checkerboard', 'grid code'],
  tags: ['code', 'historical', 'coordinates', 'grid'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  options: [
    { type: 'text', key: 'key', label: 'Square key (optional)', default: '', help: 'Letters of the key fill the square first. The classic 5×5 grid merges I/J.' }
  ],
  actions: [
    {
      id: 'encode', label: 'Encode', kind: 'encode',
      run: (v, o) => {
        const alpha = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';
        let sq = '';
        for (const ch of (String(o.key ?? '').toUpperCase() + alpha)) if (alpha.includes(ch) && !sq.includes(ch)) sq += ch;
        const parts: string[] = [];
        for (const ch of v.text.toUpperCase()) {
          if (ch === ' ') { parts.push('/'); continue; }
          let c = ch;
          if (c === 'J') c = 'I';
          const i = sq.indexOf(c);
          if (i < 0) throw new Error(`Polybius square covers letters only. Unsupported: "${ch}"`);
          parts.push(`${Math.floor(i / 5) + 1}${(i % 5) + 1}`);
        }
        return textValue(parts.join(' '), 'encoded');
      }
    },
    {
      id: 'decode', label: 'Decode', kind: 'decode',
      run: (v, o) => {
        const alpha = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';
        let sq = '';
        for (const ch of (String(o.key ?? '').toUpperCase() + alpha)) if (alpha.includes(ch) && !sq.includes(ch)) sq += ch;
        let out = '';
        for (const token of v.text.trim().split(/\s+/)) {
          if (token === '/') { out += ' '; continue; }
          if (!/^[1-5]{2}$/.test(token)) throw new Error(`"${token}" is not a valid coordinate pair (11–55).`);
          out += sq[(Number(token[0]) - 1) * 5 + (Number(token[1]) - 1)];
        }
        return textValue(out);
      }
    }
  ],
  examples: [{ label: 'Greek', input: 'POLYBIUS' }]
});

/* ------------------------------------ T9 ---------------------------------- */

const T9: Record<string, string> = {};
'ABC2 DEF3 GHI4 JKL5 MNO6 PQRS7 TUV8 WXYZ9'.split(' ').forEach((g) => {
  const d = g.slice(-1);
  for (const c of g.slice(0, -1)) T9[c] = d;
});

defineOp({
  id: 't9-keypad',
  name: 'T9 Phone Keypad',
  category: 'codes',
  description: 'Maps letters to phone-keypad digits (ABC=2 … WXYZ=9). Encoding is unambiguous; the reverse is inherently one-to-many.',
  aliases: ['phone keypad', 'phone number code', 'multitap', 'vanity number', 't9'],
  tags: ['code', 'phone', 'digits', 'puzzle'],
  input: 'text',
  output: 'encoded',
  reversible: false,
  engine: 'typescript',
  options: [
    { type: 'toggle', key: 'multiTap', label: 'Multi-tap presses (7777 = S)', default: false, help: 'Otherwise outputs one digit per letter.' }
  ],
  actions: [
    {
      id: 'encode', label: 'Convert', kind: 'convert',
      run: (v, o) => {
        const out: string[] = [];
        for (const ch of v.text.toUpperCase()) {
          if (ch === ' ') { out.push('0'); continue; }
          if (/[0-9]/.test(ch)) { out.push(ch); continue; }
          const d = T9[ch];
          if (!d) throw new Error(`T9 covers A–Z and digits. Unsupported: "${ch}"`);
          if (o.multiTap) {
            const group = 'ABC DEF GHI JKL MNO PQRS TUV WXYZ'.split(' ').find((g) => g.includes(ch))!;
            out.push(d.repeat(group.indexOf(ch) + 1));
          } else out.push(d);
        }
        return textValue(out.join(' '), 'encoded');
      }
    },
    {
      id: 'decode', label: 'Decode multi-tap', kind: 'decode',
      run: (v) => {
        const groups = v.text.trim().split(/\s+/);
        const out: string[] = [];
        for (const g of groups) {
          if (!/^(\d)\1*$/.test(g)) throw new Error(`"${g}" mixes digits — multi-tap groups repeat one key (e.g. 7777).`);
          const d = g[0];
          if (d === '0' || d === '1') throw new Error(`Key ${d} carries no letters on a classic T9 keypad.`);
          const letters = 'ABC DEF GHI JKL MNO PQRS TUV WXYZ'.split(' ')[Number(d) - 2];
          const idx = g.length - 1;
          if (idx >= letters.length) throw new Error(`"${g}" presses key ${d} too many times (max ${letters.length}).`);
          out.push(letters[idx]);
        }
        return textValue(out.join(''));
      }
    }
  ],
  examples: [{ label: 'Call me', input: 'HELLO' }],
  warnings: ['Single-digit-per-letter encoding cannot be uniquely decoded — many words share a digit sequence (e.g. 4663 = HOME/GOOD).'],
  docs: 'Multi-tap mode records physical key presses, which decodes unambiguously. Spaces map to 0 by convention.'
});

/* ------------------------------ BAUDOT / ITA2 ------------------------------ */

// ITA2 five-unit code, bits written MSB-first as commonly tabulated.
const BAUDOT_LTRS: [string, string][] = [
  ['00011', 'A'], ['11001', 'B'], ['01110', 'C'], ['01001', 'D'], ['00001', 'E'], ['01101', 'F'],
  ['11010', 'G'], ['10100', 'H'], ['00110', 'I'], ['01011', 'J'], ['01111', 'K'], ['10010', 'L'],
  ['11100', 'M'], ['01100', 'N'], ['11000', 'O'], ['10110', 'P'], ['10111', 'Q'], ['01010', 'R'],
  ['00101', 'S'], ['10000', 'T'], ['00111', 'U'], ['11110', 'V'], ['10011', 'W'], ['11101', 'X'],
  ['10101', 'Y'], ['10001', 'Z']
];
const BAUDOT_FIGS: Record<string, string> = {
  Q: '1', W: '2', E: '3', R: '4', T: '5', Y: '6', U: '7', I: '8', O: '9', P: '0'
};
const FIGS_SHIFT = '11011';
const LTRS_SHIFT = '11111';
const SPACE_CODE = '00100';

defineOp({
  id: 'baudot-ita2',
  name: 'Baudot Code (ITA2)',
  category: 'codes',
  historicalName: 'Baudot–Murray code (1874 / 1931)',
  description: 'The 5-bit teleprinter code behind teletype machines. Letters and figures share codes via LTRS/FIGS shift states.',
  aliases: ['baudot', 'ita2', 'teletype', 'teleprinter', '5-bit'],
  tags: ['code', 'telegraph', 'historical', 'binary'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    {
      id: 'encode', label: 'Encode', kind: 'encode',
      run: (v) => {
        const ltrs = Object.fromEntries(BAUDOT_LTRS.map(([b, c]) => [c, b]));
        const figs = Object.fromEntries(Object.entries(BAUDOT_FIGS).map(([c, d]) => [d, ltrs[c]]));
        const codes: string[] = [];
        let mode: 'L' | 'F' = 'L';
        for (const raw of v.text.toUpperCase()) {
          const ch = raw === '\n' ? ' ' : raw;
          let target: string | undefined;
          let needMode: 'L' | 'F' = 'L';
          if (ch === ' ') target = SPACE_CODE;
          else if (ltrs[ch]) target = ltrs[ch];
          else if (figs[ch]) { target = figs[ch]; needMode = 'F'; }
          else throw new Error(`ITA2 supports letters, digits and space. Unsupported: "${raw}"`);
          if (ch !== ' ' && needMode !== mode) {
            codes.push(needMode === 'F' ? FIGS_SHIFT : LTRS_SHIFT);
            mode = needMode;
          }
          codes.push(target);
        }
        return textValue(codes.join(' '), 'encoded');
      }
    },
    {
      id: 'decode', label: 'Decode', kind: 'decode',
      run: (v) => {
        const clean = v.text.replace(/[^01]/g, '');
        if (clean.length % 5 !== 0) throw new Error(`ITA2 input has ${clean.length} bits — not a multiple of 5.`);
        const rev = Object.fromEntries(BAUDOT_LTRS);
        const figRev: Record<string, string> = {};
        for (const [c, d] of Object.entries(BAUDOT_FIGS)) figRev[rev[c] ?? ''] = d;
        let mode: 'L' | 'F' = 'L';
        let out = '';
        for (let i = 0; i < clean.length; i += 5) {
          const code = clean.slice(i, i + 5);
          if (code === FIGS_SHIFT) { mode = 'F'; continue; }
          if (code === LTRS_SHIFT) { mode = 'L'; continue; }
          if (code === SPACE_CODE) { out += ' '; continue; }
          const ch = mode === 'F' ? figRev[code] : rev[code];
          if (!ch) throw new Error(`Unknown ITA2 code ${code}.`);
          out += ch;
        }
        return textValue(out);
      }
    }
  ],
  examples: [{ label: 'Teletype', input: 'HELLO 2026' }],
  docs: 'The encoder inserts FIGS/LTRS shift codes automatically. Figures supported: digits 0–9 (the "QWERTY row" assignments).'
});

/* --------------------------------- BRAILLE -------------------------------- */

const BRAILLE_DOTS: Record<string, number[]> = {
  a: [1], b: [1, 2], c: [1, 4], d: [1, 4, 5], e: [1, 5], f: [1, 2, 4], g: [1, 2, 4, 5], h: [1, 2, 5],
  i: [2, 4], j: [2, 4, 5], k: [1, 3], l: [1, 2, 3], m: [1, 3, 4], n: [1, 3, 4, 5], o: [1, 3, 5],
  p: [1, 2, 3, 4], q: [1, 2, 3, 4, 5], r: [1, 2, 3, 5], s: [2, 3, 4], t: [2, 3, 4, 5],
  u: [1, 3, 6], v: [1, 2, 3, 6], w: [2, 4, 5, 6], x: [1, 3, 4, 6], y: [1, 3, 4, 5, 6], z: [1, 3, 5, 6]
};
const DOT_BITS = [1, 2, 4, 8, 16, 32, 64, 128];

function brailleChar(dots: number[]): string {
  let bits = 0;
  for (const d of dots) bits |= DOT_BITS[d - 1];
  return String.fromCodePoint(0x2800 + bits);
}

function buildBrailleMaps() {
  const enc = new Map<string, string>();
  const dec = new Map<string, string>();
  for (const [ch, dots] of Object.entries(BRAILLE_DOTS)) {
    const b = brailleChar(dots);
    enc.set(ch, b);
    dec.set(b, ch);
  }
  const numSign = brailleChar([3, 4, 5, 6]);
  const capSign = brailleChar([6]);
  return { enc, dec, numSign, capSign };
}

defineOp({
  id: 'braille',
  name: 'Braille Patterns',
  category: 'codes',
  description: 'Grade 1 (uncontracted) braille as Unicode braille patterns (⠓⠑⠇⠇⠕). A faithful textual representation of the tactile cells.',
  aliases: ['braille code', 'unicode braille', 'dots'],
  tags: ['code', 'accessibility', 'unicode', 'visual'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    {
      id: 'encode', label: 'Encode', kind: 'encode',
      run: (v) => {
        const { enc, numSign, capSign } = buildBrailleMaps();
        let out = '';
        let numMode = false;
        for (const ch of v.text) {
          if (ch === ' ') { out += ' '; numMode = false; continue; }
          if (/[0-9]/.test(ch)) {
            if (!numMode) { out += numSign; numMode = true; }
            // Digits reuse cells a–j: 1→a … 9→i, 0→j.
            const letter = String.fromCharCode(97 + ((Number(ch) + 9) % 10));
            out += brailleChar(BRAILLE_DOTS[letter]);
            continue;
          }
          numMode = false;
          const lower = ch.toLowerCase();
          if (!(lower >= 'a' && lower <= 'z')) throw new Error(`Grade 1 braille here covers A–Z, digits and space. Unsupported: "${ch}"`);
          if (ch !== lower) out += capSign;
          out += enc.get(lower);
        }
        return textValue(out, 'encoded');
      }
    },
    {
      id: 'decode', label: 'Decode', kind: 'decode',
      run: (v) => {
        const { dec, numSign, capSign } = buildBrailleMaps();
        let out = '';
        let numMode = false;
        let capNext = false;
        for (const ch of v.text) {
          if (ch === ' ') { out += ' '; numMode = false; continue; }
          if (ch === numSign) { numMode = true; continue; }
          if (ch === capSign) { capNext = true; continue; }
          const letter = dec.get(ch);
          if (!letter) throw new Error(`"${ch}" is not one of the 26 Grade 1 braille letters.`);
          if (numMode) {
            const digits = 'jabcdefghi';
            const idx = digits.indexOf(letter);
            if (idx < 0) throw new Error('Expected a–j after the braille number sign.');
            out += String(idx);
            continue;
          }
          out += capNext ? letter.toUpperCase() : letter;
          capNext = false;
        }
        return textValue(out);
      }
    }
  ],
  examples: [{ label: 'Tactile text', input: 'Braille 1836' }],
  docs: 'Digits follow the number sign ⠼ (a–j = 1–0). Capitals are preceded by ⠠. This is a textual representation of the cells — physical braille semantics (spacing, contraction grades) are out of scope.'
});

/* -------------------------------- SEMAPHORE ------------------------------- */

// Rotary-dial positions (1..8 on a clock-face circle), pairs i<j.
const SEMAPHORE_PAIRS: [string, [number, number]][] = [
  ['A', [1, 2]], ['B', [1, 3]], ['C', [1, 4]], ['D', [1, 5]], ['E', [1, 6]], ['F', [1, 7]], ['G', [1, 8]],
  ['H', [2, 3]], ['I', [2, 4]], ['K', [2, 5]], ['L', [2, 6]], ['M', [2, 7]], ['N', [2, 8]],
  ['O', [3, 4]], ['P', [3, 5]], ['Q', [3, 6]], ['R', [3, 7]], ['S', [3, 8]],
  ['T', [4, 5]], ['U', [4, 6]], ['Y', [4, 7]],
  ['J', [5, 7]], ['V', [5, 8]],
  ['W', [6, 7]], ['X', [6, 8]],
  ['Z', [7, 8]]
];
const SEMAPHORE_NUMERIC: [number, number] = [5, 6];

defineOp({
  id: 'semaphore',
  name: 'Flag Semaphore',
  category: 'codes',
  description: 'Flag-signal positions as accessible clock-face coordinates (e.g. H = 2-3). Letters, with the numeric-shift for digits.',
  aliases: ['semaphore flags', 'flag signals', 'nautical flags'],
  tags: ['code', 'signal', 'visual', 'historical'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    {
      id: 'encode', label: 'Encode', kind: 'encode',
      run: (v) => {
        const map = new Map(SEMAPHORE_PAIRS);
        const parts: string[] = [];
        let numMode = false;
        const digits: Record<string, string> = { '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E', '6': 'F', '7': 'G', '8': 'H', '9': 'I', '0': 'K' };
        for (const ch of v.text.toUpperCase()) {
          if (ch === ' ') { parts.push('/'); numMode = false; continue; }
          if (/[0-9]/.test(ch)) {
            if (!numMode) { parts.push(`${SEMAPHORE_NUMERIC[0]}-${SEMAPHORE_NUMERIC[1]}`); numMode = true; }
            parts.push(map.get(digits[ch])!.join('-'));
            continue;
          }
          numMode = false;
          const pair = map.get(ch);
          if (!pair) throw new Error(`Semaphore covers A–Z, digits and space. Unsupported: "${ch}"`);
          parts.push(pair.join('-'));
        }
        return textValue(parts.join(' '), 'encoded');
      }
    },
    {
      id: 'decode', label: 'Decode', kind: 'decode',
      run: (v) => {
        const rev = new Map(SEMAPHORE_PAIRS.map(([c, p]) => [p.join('-'), c]));
        const digitFor: Record<string, string> = { A: '1', B: '2', C: '3', D: '4', E: '5', F: '6', G: '7', H: '8', I: '9', K: '0' };
        let numMode = false;
        let out = '';
        for (const token of v.text.trim().split(/\s+/)) {
          if (token === '/') { out += ' '; numMode = false; continue; }
          if (token === SEMAPHORE_NUMERIC.join('-')) { numMode = true; continue; }
          const ch = rev.get(token);
          if (!ch) throw new Error(`"${token}" is not a semaphore letter position (use forms like 2-3, both arms 1–8).`);
          out += numMode ? (digitFor[ch] ?? (() => { throw new Error(`Position ${token} has no digit value.`); })()) : ch;
        }
        return textValue(out);
      }
    }
  ],
  examples: [{ label: 'Signal', input: 'HELP 911' }],
  docs: 'Positions are numbered 1–8 around the signaler. The pair 5-6 is the "numeric" shift: following A–I codes read as digits 1–9, and K as 0. Slash ("/") separates words.'
});

/* ------------------------- NUMERIC REPRESENTATIONS ------------------------ */

defineOp({
  id: 'binary-text',
  name: 'Binary Representation',
  category: 'codes',
  description: 'Shows text as the raw binary digits of its UTF-8 bytes — 8 bits per byte, space-separated.',
  aliases: ['text to binary', 'binary code', 'bits', '01'],
  tags: ['binary', 'bytes', 'representation'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    { id: 'encode', label: 'To binary', kind: 'convert', run: (v) => textValue(bytesToBinary(utf8.encode(v.text)), 'encoded') },
    { id: 'decode', label: 'From binary', kind: 'convert', run: (v) => textValue(utf8.decodeStrict(binaryToBytes(v.text))) }
  ],
  examples: [{ label: 'Hi in binary', input: 'Hi' }]
});

defineOp({
  id: 'hex-text',
  name: 'Hexadecimal Representation',
  category: 'codes',
  description: 'Renders text as the hexadecimal values of its UTF-8 bytes, and restores text from hex.',
  aliases: ['hex', 'hex dump', 'text to hex', 'base16', 'hexadecimal'],
  tags: ['hex', 'bytes', 'representation', 'base16'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  options: [
    { type: 'select', key: 'style', label: 'Hex style', default: 'space', options: [
      { value: 'space', label: '48 65 6C 6C 6F' },
      { value: 'plain', label: '48656c6c6f' },
      { value: '0x', label: '0x48 0x65 0x6C…' },
      { value: 'escape', label: '\\x48\\x65\\x6C…' }
    ] }
  ],
  actions: [
    {
      id: 'encode', label: 'To hex', kind: 'convert',
      run: (v, o) => {
        const b = utf8.encode(v.text);
        const style = String(o.style ?? 'space');
        const hx = Array.from(b, (x) => x.toString(16).padStart(2, '0'));
        if (style === 'plain') return textValue(hx.join(''), 'encoded');
        if (style === '0x') return textValue(hx.map((h) => '0x' + h).join(' '), 'encoded');
        if (style === 'escape') return textValue(hx.map((h) => '\\x' + h).join(''), 'encoded');
        return textValue(hx.join(' '), 'encoded');
      }
    },
    {
      id: 'decode', label: 'From hex', kind: 'convert',
      run: (v) => textValue(utf8.decodeStrict(hexToBytes(v.text)))
    }
  ],
  examples: [{ label: 'Hello', input: 'Hello' }]
});

defineOp({
  id: 'octal-text',
  name: 'Octal Representation',
  category: 'codes',
  description: 'Text as the octal (base-8) values of its UTF-8 bytes.',
  aliases: ['octal', 'base 8', 'text to octal'],
  tags: ['octal', 'bytes', 'representation'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    { id: 'encode', label: 'To octal', kind: 'convert', run: (v) => textValue(Array.from(utf8.encode(v.text), (x) => x.toString(8).padStart(3, '0')).join(' '), 'encoded') },
    {
      id: 'decode', label: 'From octal', kind: 'convert',
      run: (v) => {
        const toks = v.text.replace(/\\o?/g, ' ').split(/\s+/).filter(Boolean);
        const b = new Uint8Array(toks.map((t) => {
          if (!/^[0-7]{1,3}$/.test(t)) throw new Error(`"${t}" is not a 1–3 digit octal byte.`);
          const n = parseInt(t, 8);
          if (n > 255) throw new Error(`"${t}" exceeds one byte (>377 octal).`);
          return n;
        }));
        return textValue(utf8.decodeStrict(b));
      }
    }
  ]
});

defineOp({
  id: 'decimal-text',
  name: 'Decimal Byte Values',
  category: 'codes',
  description: 'Text as the decimal values of its UTF-8 bytes (compare A1Z26, which numbers the alphabet, not the encoding).',
  aliases: ['ascii decimal', 'byte values', 'text to decimal', 'char codes'],
  tags: ['decimal', 'bytes', 'ascii', 'representation'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    { id: 'encode', label: 'To decimal', kind: 'convert', run: (v) => textValue(Array.from(utf8.encode(v.text), String).join(' '), 'encoded') },
    {
      id: 'decode', label: 'From decimal', kind: 'convert',
      run: (v) => {
        const toks = v.text.split(/[\s,]+/).filter(Boolean);
        const b = new Uint8Array(toks.map((t) => {
          const n = Number(t);
          if (!Number.isInteger(n) || n < 0 || n > 255) throw new Error(`"${t}" is not a byte value (0–255).`);
          return n;
        }));
        return textValue(utf8.decodeStrict(b));
      }
    }
  ],
  examples: [{ label: 'ABC', input: 'ABC' }]
});

defineOp({
  id: 'unicode-codepoints',
  name: 'Unicode Code Points',
  category: 'codes',
  description: 'Each character mapped to its Unicode code point (U+0041 style or \\u0041 escape style), plane-aware for emoji.',
  aliases: ['unicode escapes', 'code points', '\\u', 'character codes'],
  tags: ['unicode', 'utf', 'codepoints', 'emoji'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  options: [
    { type: 'select', key: 'style', label: 'Style', default: 'u+', options: [
      { value: 'u+', label: 'U+0041' },
      { value: 'escape', label: '\\u0041 (JS)' },
      { value: 'html', label: '&#65; (HTML decimal)' }
    ] }
  ],
  actions: [
    {
      id: 'encode', label: 'To code points', kind: 'convert',
      run: (v, o) => {
        const style = String(o.style ?? 'u+');
        const parts = [...v.text].map((ch) => {
          const cp = ch.codePointAt(0)!;
          if (style === 'escape') return '\\u' + cp.toString(16).padStart(4, '0');
          if (style === 'html') return '&#' + cp + ';';
          return 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
        });
        return textValue(parts.join(' '), 'encoded');
      }
    },
    {
      id: 'decode', label: 'From code points', kind: 'convert',
      run: (v) => {
        const tokens = v.text.match(/U\+[0-9a-fA-F]{1,6}|\\u[0-9a-fA-F]{4}|\\u\{[0-9a-fA-F]{1,6}\}|&#\d+;|&#x[0-9a-fA-F]+;/g);
        if (!tokens) throw new Error('No code points recognised. Use U+0041, \\u0041, \\u{1F600} or &#65; forms.');
        return textValue(tokens.map((t) => {
          let hex: string;
          if (t.startsWith('U+')) hex = t.slice(2);
          else if (t.startsWith('&#x')) hex = t.slice(3, -1);
          else if (t.startsWith('&#')) return String.fromCodePoint(parseInt(t.slice(2, -1), 10));
          else if (t.startsWith('\\u{')) hex = t.slice(3, -1);
          else hex = t.slice(2);
          return String.fromCodePoint(parseInt(hex, 16));
        }).join(''));
      }
    }
  ],
  examples: [{ label: 'Emoji & ASCII', input: 'A🙂' }]
});

defineOp({
  id: 'utf8-inspector',
  name: 'UTF-8 Byte Inspector',
  category: 'codes',
  description: 'Per-character table: the character, its code point, and the exact UTF-8 byte sequence it encodes to.',
  aliases: ['utf8 view', 'encoding inspector', 'utf-8 analysis'],
  tags: ['unicode', 'utf-8', 'analysis', 'bytes'],
  input: 'text',
  output: 'text',
  reversible: false,
  engine: 'typescript',
  actions: [
    {
      id: 'analyze', label: 'Inspect', kind: 'analyze',
      run: (v) => {
        const lines = ['CHAR | CODE POINT | UTF-8 BYTES (HEX)', '-----+------------+------------------'];
        for (const ch of [...v.text]) {
          const cp = 'U+' + ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0');
          const hex = bytesToHex(utf8.encode(ch));
          const shown = ch === ' ' ? '␣' : ch === '\n' ? '⏎' : ch === '\t' ? '⇥' : ch;
          lines.push(`${shown.padEnd(4)} | ${cp.padEnd(10)} | ${hex}`);
        }
        return textValue(lines.join('\n'));
      }
    }
  ],
  examples: [{ label: 'Mixed script', input: 'A€🙂' }]
});
