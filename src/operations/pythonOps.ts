// Python-backed operations. These execute inside Pyodide (WebAssembly) via the
// lazy worker bridge — real Python running locally in the browser, never on a
// server. Each op documents why Python is a natural home for it.
import { defineOp } from './core/registry';
import { textValue } from './core/types';
import type { OptionField } from './core/types';

const PY_NOTE = 'Powered by Python (Pyodide/WebAssembly) — downloaded once on first use, then runs locally in your browser.';

function pyHash(cfg: { id: string; name: string; fn: string; aliases?: string[] }) {
  defineOp({
    id: cfg.id,
    name: cfg.name,
    category: 'hashing',
    description: `Computes a ${cfg.name} digest using Python's hashlib running in WebAssembly.`,
    aliases: cfg.aliases,
    tags: ['hash', 'digest', 'one-way', 'python'],
    input: 'text',
    output: 'encoded',
    reversible: false,
    oneWay: true,
    engine: 'python',
    options: [{ type: 'text', key: 'expected', label: 'Expected digest (for Verify)', default: '' }],
    actions: [
      {
        id: 'hash', label: 'Hash', kind: 'hash',
        run: (v, _o, ctx) => ctx.python(cfg.fn, { text: v.text }).then((r) => textValue(String(r), 'encoded'))
      },
      {
        id: 'verify', label: 'Verify digest', kind: 'verify',
        run: async (v, o, ctx) => {
          const expected = String(o.expected ?? '').trim().toLowerCase();
          if (!expected) throw new Error('Paste the expected digest into the option field first.');
          const actual = String(await ctx.python(cfg.fn, { text: v.text }));
          return textValue(actual === expected
            ? `✔ MATCH — digest reproduced.\n${actual}`
            : `✘ NO MATCH\ncomputed: ${actual}\nexpected: ${expected.toLowerCase()}`);
        }
      }
    ],
    docs: `Part of the SHA-3 / BLAKE family, provided via CPython's hashlib (OpenSSL) inside Pyodide. ${PY_NOTE}`
  });
}

pyHash({ id: 'sha3-256', name: 'SHA3-256', fn: 'sha3_256', aliases: ['sha-3', 'sha3'] });
pyHash({ id: 'sha3-512', name: 'SHA3-512', fn: 'sha3_512', aliases: ['sha-3 512'] });
pyHash({ id: 'shake-256', name: 'SHAKE-256 (32-byte)', fn: 'shake_256', aliases: ['shake', 'xof'] });
pyHash({ id: 'blake2b', name: 'BLAKE2b', fn: 'blake2b', aliases: ['blake2'] });
pyHash({ id: 'blake2s', name: 'BLAKE2s', fn: 'blake2s', aliases: ['blake2 small'] });

const pyWarn = 'Classical system — educational use only. ' + PY_NOTE;

function pyCipher(cfg: {
  id: string; name: string; desc: string; fn: string; aliases?: string[]; tags?: string[];
  options: OptionField[]; example?: { label: string; input: string; options?: Record<string, unknown> }; docs?: string;
}) {
  defineOp({
    id: cfg.id,
    name: cfg.name,
    category: 'ciphers',
    description: cfg.desc,
    aliases: cfg.aliases,
    tags: cfg.tags ?? ['cipher', 'classical', 'python'],
    input: 'text',
    output: 'text',
    reversible: true,
    engine: 'python',
    options: cfg.options,
    actions: [
      {
        id: 'encipher', label: 'Encipher', kind: 'transform',
        run: (v, o, ctx) => ctx.python(cfg.fn, { text: v.text, mode: 'enc', ...o }).then((r) => textValue(String(r)))
      },
      {
        id: 'decipher', label: 'Decipher', kind: 'transform',
        run: (v, o, ctx) => ctx.python(cfg.fn, { text: v.text, mode: 'dec', ...o }).then((r) => textValue(String(r)))
      }
    ],
    examples: cfg.example ? [cfg.example] : undefined,
    warnings: [pyWarn],
    docs: cfg.docs
  });
}

pyCipher({
  id: 'bifid',
  name: 'Bifid Cipher',
  desc: 'Felix Delastelle\'s fractionating cipher: Polybius coordinates broken and recombined across a period.',
  fn: 'bifid',
  aliases: ['delastelle bifid'],
  options: [
    { type: 'text', key: 'key', label: 'Square key (optional)', default: '' },
    { type: 'number', key: 'period', label: 'Period', default: 5, min: 1, max: 25 }
  ],
  example: { label: 'Period 5', input: 'FLEEATONCE', options: { period: 5 } },
  docs: 'I/J share a cell. Non-letters are excluded from the blocks.'
});

pyCipher({
  id: 'trifid',
  name: 'Trifid Cipher',
  desc: 'Bifid in three dimensions: a 27-character cube (A–Z + ·) with coordinates fractionated across a period.',
  fn: 'trifid',
  aliases: ['delastelle trifid'],
  options: [
    { type: 'text', key: 'key', label: 'Cube key (optional)', default: '' },
    { type: 'number', key: 'period', label: 'Period', default: 5, min: 1, max: 25 }
  ],
  example: { label: 'Period 5', input: 'AIDETOILE', options: { period: 5 } }
});

pyCipher({
  id: 'nihilist',
  name: 'Nihilist Cipher',
  desc: 'Polybius-grid arithmetic: plaintext and key coordinates added as two-digit numbers — 19th-century Russian cipher.',
  fn: 'nihilist',
  aliases: ['nihilist substitution'],
  options: [
    { type: 'text', key: 'key', label: 'Key word', default: 'KRYPTOS' },
    { type: 'text', key: 'alphaKey', label: 'Square key (optional)', default: '' }
  ],
  example: { label: 'Key KRYPTOS', input: 'DYNAMITE', options: { key: 'RUSSIAN' } },
  docs: 'Encipher outputs space-separated sums (e.g. 37 53 …). Decipher expects that numeric form with the same key.'
});

pyCipher({
  id: 'four-square',
  name: 'Four-Square Cipher',
  desc: 'Delastelle\'s two-square digraph cipher: plaintext corners read off two keyed squares.',
  fn: 'foursquare',
  aliases: ['four square', '4-square playfair'],
  options: [
    { type: 'text', key: 'key1', label: 'Upper-right square key', default: 'EXAMPLE' },
    { type: 'text', key: 'key2', label: 'Lower-left square key', default: 'KEYWORD' }
  ],
  example: { label: 'Classic demo', input: 'HELPCOMEBACK', options: { key1: 'EXAMPLE', key2: 'KEYWORD' } },
  docs: 'Odd-length plaintext is padded with X. I/J share a cell in every square.'
});

pyCipher({
  id: 'fractionated-morse',
  name: 'Fractionated Morse Cipher',
  desc: 'Morse stream (x as separators) regrouped into trigrams over {., -, x} and mapped through a keyed 26-letter alphabet.',
  fn: 'fractionated_morse',
  aliases: ['fractionated morse', 'morse cipher'],
  options: [{ type: 'text', key: 'key', label: 'Key word (optional)', default: '' }],
  example: { label: 'Keyed', input: 'ROUND HILL', options: { key: 'ROUNDTABLE' } },
  docs: 'One of the classic "fractionation" ciphers — Morse\'s variable-length structure makes the frequency signature unusual.'
});

pyCipher({
  id: 'hill',
  name: 'Hill Cipher',
  desc: 'Linear algebra encryption: plaintext blocks multiplied by a key matrix mod 26 (2×2 or 3×3).',
  fn: 'hill',
  aliases: ['hill cipher', 'matrix cipher'],
  options: [
    { type: 'text', key: 'matrix', label: 'Key matrix (4 or 9 numbers)', default: '3 2 5 7',
      help: 'Row-major, e.g. "3 2 5 7" for a 2×2. Determinant must be invertible mod 26.' }
  ],
  example: { label: '2×2 classic', input: 'HELPME', options: { matrix: '3 2 5 7' } },
  docs: 'Matrix math is where Python shines — this op uses pure standard-library modular arithmetic inside Pyodide.'
});
