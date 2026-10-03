// Text Transformations — second wave: casing variants, line utilities,
// whitespace tools, padding/wrapping, anagram-canonicalization, and a
// honest line-based diff.
import { defineOp } from './core/registry';
import { textValue } from './core/types';

function simple(id: string, name: string, desc: string, fn: (s: string) => string, opts?: { aliases?: string[]; tags?: string[]; example?: string }) {
  defineOp({
    id,
    name,
    category: 'text',
    description: desc,
    aliases: opts?.aliases,
    tags: opts?.tags ?? ['text'],
    input: 'text',
    output: 'text',
    reversible: false,
    engine: 'typescript',
    actions: [{ id: 'apply', label: 'Apply', kind: 'convert', run: (v) => textValue(fn(v.text)) }],
    examples: opts?.example ? [{ label: 'Try', input: opts.example }] : undefined
  });
}

/* --------------------------------- casing ---------------------------------- */

simple('title-case', 'Title Case', 'Capitalize the first letter of every word (simple lexical title casing).',
  (s) => s.replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, sep, ch: string) => sep + ch.toUpperCase()),
  { aliases: ['capitalize words', 'headline case'], example: 'the quick brown fox jumps' });

simple('invert-case', 'iNVERT cASE', 'Swap the case of every letter.',
  (s) => [...s].map((c) => c.toLowerCase() !== c ? c.toLowerCase() : c.toUpperCase()).join(''),
  { example: 'Hello World 123' });

simple('alternating-case', 'aLtErNaTiNg CaSe', 'Mocking-SpongeBob style alternating lower/UPPER.',
  (s) => {
    let upper = false;
    return [...s].map((c) => /[\p{L}]/u.test(c) ? ((upper = !upper) ? c.toLowerCase() : c.toUpperCase()) : c).join('');
  }, { aliases: ['spongebob case', 'mocking case'], example: 'i am not mocking you' });

simple('random-case', 'RaNDoM cAsE', 'Randomizes letter case each run.',
  (s) => [...s].map((c) => Math.random() < 0.5 ? c.toLowerCase() : c.toUpperCase()).join(''),
  { example: 'every run is different' });

/* ------------------------------ line utilities ------------------------------ */

defineOp({
  id: 'line-endings',
  name: 'Line Endings Converter',
  category: 'text',
  description: 'Normalize between LF (Unix), CRLF (Windows) and CR (classic Mac) line endings.',
  aliases: ['crlf', 'lf', 'dos2unix', 'unix2dos', 'newline convert'],
  tags: ['text', 'lines', 'whitespace'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'typescript',
  options: [{ type: 'select', key: 'target', label: 'Target', default: 'LF', options: [
    { value: 'LF', label: 'LF — Unix (\\n)' },
    { value: 'CRLF', label: 'CRLF — Windows (\\r\\n)' },
    { value: 'CR', label: 'CR — classic Mac (\\r)' }
  ] }],
  actions: [
    {
      id: 'convert', label: 'Convert', kind: 'convert',
      run: (v, o) => {
        const normalized = v.text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const sep = ({ LF: '\n', CRLF: '\r\n', CR: '\r' } as Record<string, string>)[String(o.target)];
        return textValue(normalized.replace(/\n/g, sep));
      }
    },
    {
      id: 'analyze', label: 'Detect', kind: 'analyze',
      run: (v) => {
        const crlf = (v.text.match(/\r\n/g) ?? []).length;
        const lf = (v.text.match(/(?<!\r)\n/g) ?? []).length;
        const cr = (v.text.match(/\r(?!\n)/g) ?? []).length;
        const verdict = crlf && !lf && !cr ? 'pure CRLF (Windows)' : lf && !crlf && !cr ? 'pure LF (Unix)' : cr && !crlf && !lf ? 'pure CR (classic Mac)'
          : !crlf && !lf && !cr ? 'single line — no terminators found' : 'MIXED line endings';
        return textValue(`CRLF pairs: ${crlf}\nBare LF:    ${lf}\nBare CR:    ${cr}\n\nVerdict: ${verdict}`);
      }
    }
  ],
  examples: [{ label: 'Detect me', input: 'first\r\nsecond\nthird' }]
});

simple('remove-blank-lines', 'Remove Blank Lines', 'Deletes lines that contain nothing but whitespace.',
  (s) => s.split('\n').filter((l) => l.trim() !== '').join('\n'),
  { example: 'keep\n\n\ndrop\n  \nkeep' });

simple('dedupe-lines', 'Remove Duplicate Lines', 'Keeps only the first occurrence of each exact line.',
  (s) => {
    const seen = new Set<string>();
    return s.split('\n').filter((l) => !seen.has(l) && (seen.add(l), true)).join('\n');
  }, { aliases: ['unique lines'], example: 'apple\nbanana\napple\ncherry\nbanana' });

defineOp({
  id: 'number-lines',
  name: 'Number Lines',
  category: 'text',
  description: 'Adds line numbers with configurable start, step and separator (nl-style).',
  aliases: ['nl', 'line numbers'],
  tags: ['text', 'lines', 'format'],
  input: 'text',
  output: 'text',
  reversible: false,
  engine: 'typescript',
  options: [
    { type: 'number', key: 'start', label: 'Start', default: 1 },
    { type: 'number', key: 'step', label: 'Step', default: 1, min: 1 },
    { type: 'text', key: 'sep', label: 'Separator', default: ': ' }
  ],
  actions: [{
    id: 'apply', label: 'Number', kind: 'convert',
    run: (v, o) => {
      let n = Number(o.start ?? 1);
      const step = Number(o.step ?? 1);
      const sep = String(o.sep ?? ': ');
      return textValue(v.text.split('\n').map((l) => {
        const out = `${n}${sep}${l}`;
        n += step;
        return out;
      }).join('\n'));
    }
  }],
  examples: [{ label: 'Poem', input: 'roses are red\nviolets are blue' }]
});

simple('shuffle-lines', 'Shuffle Lines', 'Randomizes line order (Fisher–Yates). Every run differs.',
  (s) => {
    const lines = s.split('\n');
    for (let i = lines.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [lines[i], lines[j]] = [lines[j], lines[i]];
    }
    return lines.join('\n');
  }, { example: 'one\ntwo\nthree\nfour' });

defineOp({
  id: 'sort-by-length',
  name: 'Sort Lines by Length',
  category: 'text',
  description: 'Sorts lines shortest-first (or longest-first), tie-breaking alphabetically.',
  aliases: ['length sort'],
  tags: ['text', 'lines', 'sort'],
  input: 'text',
  output: 'text',
  reversible: false,
  engine: 'typescript',
  options: [{ type: 'select', key: 'dir', label: 'Direction', default: 'asc', options: [{ value: 'asc', label: 'Shortest first' }, { value: 'desc', label: 'Longest first' }] }],
  actions: [{
    id: 'apply', label: 'Sort', kind: 'convert',
    run: (v, o) => textValue(
      v.text.split('\n')
        .map((l, i) => ({ l, i }))
        .sort((a, b) => (a.l.length - b.l.length || a.l.localeCompare(b.l) || a.i - b.i) * (o.dir === 'desc' ? -1 : 1))
        .map((x) => x.l).join('\n')
    )
  }],
  examples: [{ label: 'Length mix', input: 'ccc\na\nbb' }]
});

defineOp({
  id: 'split-join-list',
  name: 'Split ↔ Join List',
  category: 'text',
  description: 'Turns a delimited blob into lines, or lines into a delimited blob. Default: comma ⇄ newline.',
  aliases: ['csv to lines', 'join lines', 'split list'],
  tags: ['text', 'list', 'convert'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'typescript',
  options: [{ type: 'text', key: 'delim', label: 'Delimiter', default: ', ' }],
  actions: [
    { id: 'encode', label: 'Lines → list', kind: 'convert', run: (v, o) => textValue(v.text.split('\n').map((l) => l.trim()).filter(Boolean).join(String(o.delim ?? ', ')), 'encoded') },
    { id: 'decode', label: 'List → lines', kind: 'convert', run: (v, o) => textValue(v.text.split(String(o.delim ?? ', ')).map((l) => l.trim()).filter(Boolean).join('\n')) }
  ],
  examples: [{ label: 'Join', input: 'red\ngreen\nblue' }]
});

/* ----------------------------- whitespace / layout -------------------------- */

defineOp({
  id: 'tabs-spaces',
  name: 'Tabs ↔ Spaces',
  category: 'text',
  description: 'Converts leading tabs to spaces and back, with configurable width.',
  aliases: ['detab', 'entab', 'tabs to spaces'],
  tags: ['text', 'whitespace'],
  input: 'text',
  output: 'text',
  reversible: true,
  lossy: true,
  engine: 'typescript',
  options: [{ type: 'number', key: 'width', label: 'Tab width', default: 4, min: 1, max: 16 }],
  actions: [
    { id: 'encode', label: 'Tabs → spaces', kind: 'convert', run: (v, o) => textValue(v.text.replace(/^[\t]+/gm, (t) => ' '.repeat(t.length * Number(o.width ?? 4)))) },
    { id: 'decode', label: 'Spaces → tabs', kind: 'convert', run: (v, o) => textValue(v.text.replace(/^( +)/gm, (sp) => '\t'.repeat(Math.floor(sp.length / Number(o.width ?? 4))) + ' '.repeat(sp.length % Number(o.width ?? 4)))) }
  ],
  examples: [{ label: 'Indented', input: '\tif (tabs) {\n\t\tcry();\n\t}' }],
  docs: 'Only LEADING indentation is converted — interior tabs are data and stay untouched.'
});

defineOp({
  id: 'indent-dedent',
  name: 'Indent / Dedent',
  category: 'text',
  description: 'Adds or removes N spaces of indentation on every line.',
  aliases: ['shift left', 'shift right', 'tab block'],
  tags: ['text', 'whitespace'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'typescript',
  options: [{ type: 'number', key: 'spaces', label: 'Spaces', default: 4, min: 1, max: 32 }],
  actions: [
    { id: 'encode', label: 'Indent →', kind: 'convert', run: (v, o) => textValue(v.text.split('\n').map((l) => ' '.repeat(Number(o.spaces ?? 4)) + l).join('\n')) },
    { id: 'decode', label: '← Dedent', kind: 'convert', run: (v, o) => textValue(v.text.split('\n').map((l) => l.replace(new RegExp(`^ {0,${Number(o.spaces ?? 4)}}`), '')).join('\n')) }
  ],
  examples: [{ label: 'Block', input: 'line one\nline two' }]
});

defineOp({
  id: 'pad-lines',
  name: 'Pad Lines to Width',
  category: 'text',
  description: 'Left-pads, right-pads or centers every line to a fixed character width.',
  aliases: ['justify', 'pad text', 'fixed width'],
  tags: ['text', 'align', 'format'],
  input: 'text',
  output: 'text',
  reversible: false,
  engine: 'typescript',
  options: [
    { type: 'number', key: 'width', label: 'Width', default: 20, min: 1, max: 500 },
    { type: 'select', key: 'side', label: 'Alignment', default: 'left', options: [{ value: 'left', label: 'Text left (pad right)' }, { value: 'right', label: 'Text right (pad left)' }, { value: 'center', label: 'Center' }] },
    { type: 'text', key: 'fill', label: 'Fill character', default: ' ' }
  ],
  actions: [{
    id: 'apply', label: 'Pad', kind: 'convert',
    run: (v, o) => {
      const width = Number(o.width ?? 20);
      const fill = (String(o.fill) || ' ')[0];
      return textValue(v.text.split('\n').map((l) => {
        if ([...l].length >= width) return l;
        const gap = width - [...l].length;
        if (o.side === 'right') return fill.repeat(gap) + l;
        if (o.side === 'center') { const left = Math.floor(gap / 2); return fill.repeat(left) + l + fill.repeat(gap - left); }
        return l + fill.repeat(gap);
      }).join('\n'));
    }
  }],
  examples: [{ label: 'Receipt', input: 'coffee 2.50\nbagel 1.75', options: { side: 'right', width: 16, fill: '.' } }]
});

defineOp({
  id: 'text-wrap',
  name: 'Word Wrap / Unwrap',
  category: 'text',
  description: 'Re-wraps paragraphs to a target column, or unwraps hard-wrapped text into flowing paragraphs.',
  aliases: ['fold', 'reflow', 'hard wrap'],
  tags: ['text', 'format', 'lines'],
  input: 'text',
  output: 'text',
  reversible: false,
  engine: 'typescript',
  options: [{ type: 'number', key: 'width', label: 'Column width', default: 60, min: 10, max: 240 }],
  actions: [
    {
      id: 'encode', label: 'Wrap', kind: 'convert',
      run: (v, o) => {
        const width = Number(o.width ?? 60);
        const out: string[] = [];
        for (const para of v.text.split(/\n{2,}/)) {
          let line = '';
          for (const word of para.split(/\s+/).filter(Boolean)) {
            if ((line + (line ? ' ' : '') + word).length > width && line) { out.push(line); line = word; }
            else line = line ? line + ' ' + word : word;
          }
          out.push(line, '');
        }
        return textValue(out.join('\n').replace(/\n+$/, ''));
      }
    },
    { id: 'decode', label: 'Unwrap', kind: 'convert', run: (v) => textValue(v.text.split(/\n{2,}/).map((p) => p.split('\n').join(' ')).join('\n\n')) }
  ],
  examples: [{ label: 'Long sentence', input: 'The quick sly fox jumped over the lazy brown dog repeatedly while everyone watched in complete and utter bewildered silence.' }]
});

/* ------------------------------ extraction tools ---------------------------- */

simple('vowel-consonant-split', 'Vowels / Consonants Splitter', 'Outputs vowels, then consonants, then everything else — grouped.',
  (s) => {
    const vowels = [...s].filter((c) => /[aeiouAEIOU]/.test(c)).join('');
    const cons = [...s].filter((c) => /[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]/.test(c)).join('');
    const other = [...s].filter((c) => !/[a-zA-Z]/.test(c)).join('');
    return `Vowels (${vowels.length}):\n${vowels}\n\nConsonants (${cons.length}):\n${cons}\n\nOther (${other.length}):\n${other}`;
  }, { example: 'Cryptography hides meaning, not existence.' });

defineOp({
  id: 'anagram-canonical',
  name: 'Anagram Canonical Form',
  category: 'text',
  description: 'Sorts each word\'s letters alphabetically (optionally the WHOLE input) — equal outputs mean anagrams.',
  aliases: ['anagram checker', 'anagram signature', 'sort letters'],
  tags: ['text', 'puzzle', 'anagram'],
  input: 'text',
  output: 'text',
  reversible: false,
  engine: 'typescript',
  options: [{ type: 'toggle', key: 'perWord', label: 'Per word (off = whole text as one string)', default: true }],
  actions: [{
    id: 'apply', label: 'Canonicalize', kind: 'convert',
    run: (v, o) => {
      const sortStr = (t: string) => [...t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')].sort().join('');
      if (o.perWord) return textValue(v.text.split(/\s+/).filter(Boolean).map((w) => `${w} → ${sortStr(w)}`).join('\n'));
      return textValue(sortStr(v.text), 'encoded');
    }
  }],
  examples: [{ label: 'Classic pair', input: 'listen silent', options: { perWord: false } }],
  docs: 'Compare two texts by canonicalizing both: identical output strings = anagrams (ignoring case/spaces).'
});

/* --------------------------------- text diff -------------------------------- */

defineOp({
  id: 'line-diff',
  name: 'Line Diff (LCS)',
  category: 'text',
  description: 'Longest-common-subsequence diff between two pasted texts separated by a --- line. Unified +/-/space output.',
  aliases: ['diff', 'compare text', 'text compare'],
  tags: ['text', 'diff', 'analysis'],
  input: 'text',
  output: 'text',
  reversible: false,
  engine: 'typescript',
  actions: [
    {
      id: 'analyze', label: 'Diff', kind: 'analyze',
      run: (v) => {
        const parts = v.text.split(/\n---\n/);
        if (parts.length !== 2) throw new Error('Separate the two texts with a line containing just --- (blank line, ---, blank line).');
        const a = parts[0].split('\n');
        const b = parts[1].split('\n');
        // classic LCS dynamic programming
        const m = a.length, n = b.length;
        const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
        for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--)
          dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        const out: string[] = [];
        let i = 0, j = 0, adds = 0, dels = 0;
        while (i < m && j < n) {
          if (a[i] === b[j]) { out.push('  ' + a[i]); i++; j++; }
          else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push('- ' + a[i++]); dels++; }
          else { out.push('+ ' + b[j++]); adds++; }
        }
        while (i < m) { out.push('- ' + a[i++]); dels++; }
        while (j < n) { out.push('+ ' + b[j++]); adds++; }
        return textValue(`${out.join('\n')}\n\n— ${adds} added, ${dels} removed, ${m} → ${n} lines`);
      }
    }
  ],
  examples: [{ label: 'Two versions', input: 'alpha\nbeta\ngamma\n---\nalpha\nBETA\ngamma\ndelta' }],
  docs: 'Space prefix = present in both, "- " = only in the first text, "+ " = only in the second.'
});
