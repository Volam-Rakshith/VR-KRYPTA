// Text-level transformations: reversible character games plus a documented
// lossy one (leetspeak) — clearly labelled.
import { defineOp } from './core/registry';
import { textValue } from './core/types';

defineOp({
  id: 'reverse-text',
  name: 'Reverse Text',
  category: 'text',
  description: 'Reverse the whole string, each word, or each line. Code-point safe for emoji.',
  aliases: ['reverse string', 'backwards text', 'mirror text'],
  tags: ['text', 'reverse'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'typescript',
  options: [
    { type: 'select', key: 'granularity', label: 'Reverse…', default: 'string', options: [
      { value: 'string', label: 'Whole string' },
      { value: 'words', label: 'Characters within each word' },
      { value: 'wordOrder', label: 'Word order' },
      { value: 'lines', label: 'Line order' }
    ] }
  ],
  actions: [
    {
      id: 'apply', label: 'Reverse', kind: 'transform',
      run: (v, o) => {
        const g = String(o.granularity ?? 'string');
        if (g === 'words') return textValue(v.text.split(/(\s+)/).map((w) => ([...w].reverse().join(''))).join(''));
        if (g === 'wordOrder') return textValue(v.text.split(/(\s+)/).reverse().join(''));
        if (g === 'lines') return textValue(v.text.split('\n').reverse().join('\n'));
        return textValue([...v.text].reverse().join(''));
      }
    }
  ],
  examples: [{ label: 'Emordnilap', input: 'drawer reward' }]
});

defineOp({
  id: 'case-transform',
  name: 'Case Transformer',
  category: 'text',
  description: 'UPPERCASE, lowercase, Title Case, Sentence case and aLtErNaTiNg case conversions.',
  aliases: ['uppercase', 'lowercase', 'title case', 'capitalize'],
  tags: ['text', 'case'],
  input: 'text',
  output: 'text',
  reversible: false,
  lossy: true,
  engine: 'typescript',
  options: [
    { type: 'select', key: 'mode', label: 'Mode', default: 'upper', options: [
      { value: 'upper', label: 'UPPERCASE' },
      { value: 'lower', label: 'lowercase' },
      { value: 'title', label: 'Title Case' },
      { value: 'sentence', label: 'Sentence case' },
      { value: 'alternate', label: 'aLtErNaTiNg' }
    ] }
  ],
  actions: [
    {
      id: 'apply', label: 'Apply', kind: 'transform',
      run: (v, o) => {
        const m = String(o.mode ?? 'upper');
        if (m === 'upper') return textValue(v.text.toUpperCase());
        if (m === 'lower') return textValue(v.text.toLowerCase());
        if (m === 'title') return textValue(v.text.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()));
        if (m === 'sentence') return textValue(v.text.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, (c) => c.toUpperCase()));
        return textValue([...v.text].map((c, i) => (i % 2 ? c.toUpperCase() : c.toLowerCase())).join(''));
      }
    }
  ],
  warnings: ['Case conversion is lossy: the original capitalization cannot be recovered.']
});

const LEET: Record<string, string> = {
  A: '4', E: '3', I: '1', O: '0', S: '5', T: '7', B: '8', G: '6', Z: '2', L: '1'
};

defineOp({
  id: 'leetspeak',
  name: 'Leetspeak (1337)',
  category: 'text',
  description: 'Substitutes hacker-forum glyphs for letters (A→4, E→3, …). Decode accepts 3→E-style digits but is documented as ambiguous.',
  aliases: ['1337', 'leet', 'h4x0r'],
  tags: ['text', 'fun', 'substitution'],
  input: 'text',
  output: 'text',
  reversible: false,
  lossy: true,
  engine: 'typescript',
  actions: [
    {
      id: 'encode', label: 'To 1337', kind: 'transform',
      run: (v) => textValue(v.text.split('').map((c) => LEET[c.toUpperCase()] ?? c).join(''))
    },
    {
      id: 'decode', label: 'From 1337 (best effort)', kind: 'transform',
      run: (v) => {
        const rev: Record<string, string> = { '4': 'A', '3': 'E', '1': 'I', '0': 'O', '5': 'S', '7': 'T', '8': 'B', '6': 'G', '2': 'Z' };
        return textValue(v.text.split('').map((c) => rev[c] ?? c).join(''));
      }
    }
  ],
  examples: [{ label: 'Elite', input: 'VR KRYPTA IS ELITE' }],
  warnings: ['Lossy: "1" could be I or L, and originals are not preserved. Decoding is best-effort.']
});

defineOp({
  id: 'pig-latin',
  name: 'Pig Latin',
  category: 'text',
  description: 'Moves leading consonant clusters to the end with "ay" (or adds "way" for vowel-start words).',
  aliases: ['piglatin', 'igpay atinlay'],
  tags: ['text', 'fun', 'language'],
  input: 'text',
  output: 'text',
  reversible: false,
  lossy: true,
  engine: 'typescript',
  actions: [
    {
      id: 'apply', label: 'Apply', kind: 'transform',
      run: (v) => textValue(v.text.replace(/[A-Za-z]+/g, (word) => {
        const m = word.match(/^([^aeiou]*)(.*)$/i)!;
        return m[1] ? m[2] + m[1].toLowerCase() + 'ay' : word + 'way';
      }))
    }
  ],
  examples: [{ label: 'Oink', input: 'Pigs cannot fly' }],
  warnings: ['Pig Latin is not uniquely decodable (capitalization and cluster boundaries are lost).']
});

defineOp({
  id: 'whitespace-tools',
  name: 'Whitespace Normalizer',
  category: 'text',
  description: 'Collapse runs of spaces, trim lines, convert tabs, and flatten line endings — deterministic cleanup.',
  aliases: ['trim spaces', 'normalize whitespace', 'clean text'],
  tags: ['text', 'whitespace'],
  input: 'text',
  output: 'text',
  reversible: false,
  lossy: true,
  engine: 'typescript',
  options: [
    { type: 'toggle', key: 'collapseSpaces', label: 'Collapse multiple spaces', default: true },
    { type: 'toggle', key: 'trimLines', label: 'Trim line ends', default: true },
    { type: 'toggle', key: 'collapseBlankLines', label: 'Collapse blank lines', default: false }
  ],
  actions: [
    {
      id: 'apply', label: 'Normalize', kind: 'transform',
      run: (v, o) => {
        let s = v.text.replace(/\r\n?/g, '\n');
        if (o.trimLines) s = s.split('\n').map((l) => l.replace(/[ \t]+$/g, '').replace(/^[ \t]+/g, '')).join('\n');
        if (o.collapseSpaces) s = s.replace(/[ \t]{2,}/g, ' ');
        if (o.collapseBlankLines) s = s.replace(/\n{3,}/g, '\n\n');
        return textValue(s);
      }
    }
  ],
  warnings: ['Whitespace changes cannot be undone — original spacing is discarded.']
});

defineOp({
  id: 'slugify',
  name: 'Slugify',
  category: 'text',
  description: 'Convert a title into a URL-safe slug: lowercase, ASCII-folded, hyphen-separated.',
  aliases: ['url slug', 'slug generator'],
  tags: ['text', 'web', 'url'],
  input: 'text',
  output: 'text',
  reversible: false,
  lossy: true,
  engine: 'typescript',
  actions: [
    {
      id: 'apply', label: 'Slugify', kind: 'transform',
      run: (v) => textValue(
        v.text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
          .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-')
      )
    }
  ],
  examples: [{ label: 'Article title', input: 'Cracking the Vigenère: A 2026 Field Guide!' }],
  warnings: ['Slugs are lossy — diacritics are folded and punctuation dropped.']
});
