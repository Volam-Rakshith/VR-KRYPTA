// Analysis utilities: statistics that help identify what an unknown blob of
// text might be. These read - they never modify.
import { defineOp } from './core/registry';
import { textValue } from './core/types';
import { utf8 } from '../utils/bytes';

defineOp({
  id: 'frequency-analysis',
  name: 'Letter Frequency Analysis',
  category: 'analysis',
  description: 'Counts A–Z letter frequencies with a bar chart, and compares against typical English — the classic first step against monoalphabetic ciphers.',
  aliases: ['frequency count', 'letter stats', 'cryptanalysis frequency'],
  tags: ['analysis', 'statistics', 'cryptanalysis'],
  input: 'text',
  output: 'text',
  reversible: false,
  engine: 'typescript',
  actions: [
    {
      id: 'analyze', label: 'Analyze', kind: 'analyze',
      run: (v) => {
        const letters = v.text.toUpperCase().replace(/[^A-Z]/g, '');
        if (!letters) throw new Error('No A–Z letters found to analyze.');
        const counts = new Array(26).fill(0);
        for (const ch of letters) counts[ch.charCodeAt(0) - 65]++;
        const rows = counts.map((n, i) => {
          const pct = (n / letters.length) * 100;
          const bar = '█'.repeat(Math.round(pct * 2)) || '▏';
          return `${String.fromCharCode(65 + i)}  ${String(n).padStart(6)}  ${pct.toFixed(2).padStart(6)}%  ${bar}`;
        });
        const ENGLISH = 'ETAOINSHRDLCUMWFGYPBVKJXQZ';
        const ranked = counts.map((n, i) => [String.fromCharCode(65 + i), -n] as const).sort((a, b) => a[1] - b[1]).map((x) => x[0]).join('');
        return textValue(
          `Letters analyzed: ${letters.length}\n\n${rows.join('\n')}\n\nMost→least frequent: ${ranked}\nTypical English:      ${ENGLISH}\n\nIf the frequency shape matches English, suspect a monoalphabetic (Caesar/Atbash/substitution) cipher. A flat distribution suggests polyalphabetic or a modern encoding.`
        );
      }
    }
  ],
  examples: [{ label: 'English sample', input: 'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG WHILE THE CIPHER SLEEPS' }]
});

defineOp({
  id: 'text-stats',
  name: 'Text Statistics & Entropy',
  category: 'analysis',
  description: 'Character/word/byte counts and Shannon entropy — a quick fingerprint that hints whether input is text, hex, Base64, or random bytes.',
  aliases: ['text stats', 'entropy', 'statistics', 'detect encoding'],
  tags: ['analysis', 'statistics', 'entropy'],
  input: 'text',
  output: 'text',
  reversible: false,
  engine: 'typescript',
  actions: [
    {
      id: 'analyze', label: 'Analyze', kind: 'analyze',
      run: (v) => {
        const s = v.text;
        const chars = [...s].length;
        const bytes = utf8.encode(s).length;
        const words = (s.match(/\S+/g) ?? []).length;
        const lines = s === '' ? 0 : s.split('\n').length;
        const freq = new Map<string, number>();
        for (const ch of s) freq.set(ch, (freq.get(ch) ?? 0) + 1);
        let entropy = 0;
        for (const n of freq.values()) {
          const p = n / s.length;
          entropy -= p * Math.log2(p);
        }
        const uniq = freq.size;
        const insights: string[] = [];
        if (/^\s*([0-9a-fA-F]{2}[\s:]*)+$/.test(s)) insights.push('• Looks like hexadecimal bytes — try “Hexadecimal Representation” decode.');
        if (/^[A-Za-z0-9+/]+={0,2}$/.test(s.trim()) && s.trim().length % 4 === 0 && s.trim().length > 8) insights.push('• Shape matches Base64 — try the Base64 decoder.');
        if (/^[A-Z2-7]+=*$/i.test(s.trim()) && s.trim().length >= 8) insights.push('• Shape matches Base32 — try the Base32 decoder.');
        if (/^([.-]+\s+)+[.-]+/.test(s.trim())) insights.push('• Looks like Morse code — try the Morse decoder.');
        if (entropy >= 4 && entropy <= 4.7 && /[a-z]/i.test(s)) insights.push('• Entropy in typical English-text range. Cipher or plain text likely.');
        if (entropy > 5.5 && chars > 20) insights.push('• High entropy — suspect compressed/encrypted data or an encoding, not a simple cipher.');
        return textValue(
          `Characters:      ${chars}\nBytes (UTF-8):   ${bytes}\nWords:           ${words}\nLines:           ${lines}\nUnique symbols:  ${uniq}\nShannon entropy: ${entropy.toFixed(3)} bits/char\n\n${insights.length ? insights.join('\n') : '• No strong pattern detected.'}`
        );
      }
    }
  ],
  examples: [{ label: 'Detect a blob', input: 'SGVsbG8sIFZSIEtSWVBUQSE=' }]
});

defineOp({
  id: 'index-of-coincidence',
  name: 'Index of Coincidence',
  category: 'analysis',
  description: 'Measures letter-collision probability: ~0.066 smells like monoalphabetic text, ~0.038 like polyalphabetic/random — plus a Kasiski key-length estimate.',
  aliases: ['ic', 'coincidence index', 'kasiski'],
  tags: ['analysis', 'cryptanalysis', 'vigenere'],
  input: 'text',
  output: 'text',
  reversible: false,
  engine: 'typescript',
  actions: [
    {
      id: 'analyze', label: 'Analyze', kind: 'analyze',
      run: (v) => {
        const letters = v.text.toUpperCase().replace(/[^A-Z]/g, '');
        if (letters.length < 20) throw new Error('Need at least ~20 letters for a meaningful index.');
        const n = letters.length;
        const counts = new Array(26).fill(0);
        for (const ch of letters) counts[ch.charCodeAt(0) - 65]++;
        const ic = counts.reduce((acc, c) => acc + c * (c - 1), 0) / (n * (n - 1));
        // Kasiski-style: IC across coset splits for candidate key lengths.
        let best = '';
        const est: string[] = [];
        for (let L = 1; L <= 8; L++) {
          let sum = 0;
          for (let k = 0; k < L; k++) {
            const coset = new Array(26).fill(0);
            let m = 0;
            for (let i = k; i < n; i += L) { coset[letters.charCodeAt(i) - 65]++; m++; }
            if (m > 1) sum += coset.reduce((a, c) => a + c * (c - 1), 0) / (m * (m - 1));
          }
          const avg = sum / L;
          est.push(`length ${L}: avg IC ${avg.toFixed(4)}${avg > 0.06 ? '  ← plausible key length' : ''}`);
        }
        best = `\nVerdict: IC ${ic.toFixed(4)} — ${ic > 0.06 ? 'consistent with English or a MONOALPHABETIC cipher (Caesar, Atbash, substitution).' : ic < 0.045 ? 'low — consistent with a POLYALPHABETIC cipher (Vigenère-family) or near-random data.' : 'between typical ranges — try frequency analysis and the per-length table below.'}`;
        return textValue(`Letters analyzed: ${n}\nIndex of Coincidence: ${ic.toFixed(4)}\n(English ≈ 0.066, uniform random ≈ 0.038)\n${best}\n\nKey-length probe (avg coset IC):\n${est.join('\n')}`);
      }
    }
  ],
  examples: [{ label: 'IC of plain English', input: 'IT WAS THE BEST OF TIMES IT WAS THE WORST OF TIMES IT WAS THE AGE OF WISDOM' }]
});
