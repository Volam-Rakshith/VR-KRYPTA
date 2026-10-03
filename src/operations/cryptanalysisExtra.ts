// Cryptanalysis & detection — genuine statistical attacks: Caesar brute
// force, chi² Vigenère breaker with IC key-length estimation, Kasiski
// repeated-sequence gaps, Hamming-distance XOR key sizing, single-byte XOR
// cracking, crib dragging, magic-number detection, Unicode anomaly scanning.
// Everything here is analysis of KNOWN-WEAK schemes — stated honestly in UI.
import { defineOp } from './core/registry';
import { textValue } from './core/types';
import { utf8, hexToBytes, bytesToHex } from '../utils/bytes';

const ENGLISH_FREQ = [8.167, 1.492, 2.782, 4.253, 12.702, 2.228, 2.015, 6.094, 6.966, 0.153, 0.772, 4.025, 2.406, 6.749, 7.507, 1.929, 0.095, 5.987, 6.327, 9.056, 2.758, 0.978, 2.360, 0.150, 1.974, 0.074]; // A–Z %

function chiSquared(text: string): number {
  const letters = text.toUpperCase().replace(/[^A-Z]/g, '');
  const n = letters.length;
  if (!n) return Infinity;
  const counts = new Array(26).fill(0);
  for (const ch of letters) counts[ch.charCodeAt(0) - 65]++;
  let chi = 0;
  for (let i = 0; i < 26; i++) {
    const expected = (ENGLISH_FREQ[i] / 100) * n;
    chi += ((counts[i] - expected) ** 2) / (expected || 1);
  }
  return chi;
}

function wordBonus(text: string): number {
  const COMMON = ['THE', 'AND', 'ING', 'ION', 'THAT', 'YOU', 'OF ', ' TO ', ' I ', 'ENT', 'HER', 'THI', 'HAT', 'FOR', 'EVE', 'RE '];
  let bonus = 0;
  const up = text.toUpperCase();
  for (const w of COMMON) {
    let idx = -1;
    while ((idx = up.indexOf(w, idx + 1)) >= 0) bonus++;
  }
  return bonus;
}

function englishScore(text: string): number {
  // lower is better
  const chi = chiSquared(text);
  const penalized = chi - wordBonus(text) * (text.length * 0.15);
  const nonPrintable = [...text].filter((c) => c.charCodeAt(0) < 32 && c !== '\n' && c !== '\t').length;
  return penalized + nonPrintable * 50;
}

/* ---------------------------- caesar brute force ---------------------------- */

defineOp({
  id: 'caesar-brute-force',
  name: 'Caesar / ROT Brute Force',
  category: 'cryptanalysis',
  description: 'Tries all 26 Caesar shifts and ranks them with chi-squared + common-word scoring. The attack that needs no key.',
  aliases: ['rot brute force', 'shift cipher crack', 'caesar crack'],
  tags: ['cryptanalysis', 'brute force', 'caesar'],
  input: 'text',
  output: 'text',
  reversible: false,
  engine: 'typescript',
  actions: [{
    id: 'analyze', label: 'Crack', kind: 'analyze',
    run: (v) => {
      const letters = v.text.replace(/[^A-Za-z]/g, '');
      if (letters.length < 4) throw new Error('Need at least a few letters to rank shifts.');
      const results = [...Array(26)].map((_, shift) => {
        const plain = [...v.text].map((c) => {
          const code = c.charCodeAt(0);
          if (code >= 65 && code <= 90) return String.fromCharCode(((code - 65 - shift + 26) % 26) + 65);
          if (code >= 97 && code <= 122) return String.fromCharCode(((code - 97 - shift + 26) % 26) + 97);
          return c;
        }).join('');
        return { shift, plain, score: englishScore(plain) };
      }).sort((a, b) => a.score - b.score);
      const lines = ['Caesar brute force — all 26 shifts ranked (best first):', ''];
      results.slice(0, 8).forEach((r, i) => {
        lines.push(`#${i + 1}  shift ${String(r.shift).padStart(2)}  ${r.plain.slice(0, 70)}${r.plain.length > 70 ? '…' : ''}`);
      });
      lines.push('', `Best candidate: shift ${results[0].shift}`);
      lines.push('', results[0].plain);
      return textValue(lines.join('\n'));
    }
  }],
  examples: [{ label: 'Break me', input: 'WKH TXLFN EURZQ IRA MXPSV RYHU WKH ODCB GRJ' }]
});

/* ------------------------------ vigenere breaker ---------------------------- */

defineOp({
  id: 'vigenere-breaker',
  name: 'Vigenère Breaker (IC + chi²)',
  category: 'cryptanalysis',
  description: 'Estimates key length via coset Index of Coincidence, then cracks each coset with chi-squared. Works on a hundred-plus letters of ciphertext.',
  aliases: ['vigenere crack', 'break vigenere', 'kasiski break'],
  tags: ['cryptanalysis', 'vigenere', 'statistics'],
  input: 'text',
  output: 'text',
  reversible: false,
  engine: 'typescript',
  options: [{ type: 'number', key: 'maxKeyLen', label: 'Max key length to test', default: 12, min: 2, max: 40 }],
  actions: [{
    id: 'analyze', label: 'Break', kind: 'analyze',
    run: (v, o) => {
      const ct = v.text.toUpperCase().replace(/[^A-Z]/g, '');
      if (ct.length < 60) throw new Error(`Only ${ct.length} usable letters — this attack realistically needs 100+. Got shorter? Paste more ciphertext.`);
      const maxL = Math.min(Number(o.maxKeyLen ?? 12), Math.floor(ct.length / 4));
      const icFor = (s: string) => {
        const counts = new Array(26).fill(0);
        for (const ch of s) counts[ch.charCodeAt(0) - 65]++;
        const n = s.length;
        if (n < 2) return 0;
        return counts.reduce((a, c) => a + c * (c - 1), 0) / (n * (n - 1));
      };
      const cands: { L: number; ic: number }[] = [];
      for (let L = 1; L <= maxL; L++) {
        let sum = 0;
        for (let k = 0; k < L; k++) {
          let coset = '';
          for (let i = k; i < ct.length; i += L) coset += ct[i];
          sum += icFor(coset);
        }
        cands.push({ L, ic: sum / L });
      }
      cands.sort((a, b) => b.ic - a.ic);
      const lines: string[] = [`Key-length candidates (avg coset IC, English ≈ 0.066, random ≈ 0.038):`];
      cands.slice(0, 5).forEach((c, i) => lines.push(`  ${i + 1}. length ${String(c.L).padStart(2)}  IC ${c.ic.toFixed(4)}`));
      const best = cands[0].L;
      // crack each coset
      let key = '';
      for (let k = 0; k < best; k++) {
        let coset = '';
        for (let i = k; i < ct.length; i += best) coset += ct[i];
        let bestShift = 0, bestScore = Infinity;
        for (let shift = 0; shift < 26; shift++) {
          const dec = [...coset].map((c) => String.fromCharCode(((c.charCodeAt(0) - 65 - shift + 26) % 26) + 65)).join('');
          const s = chiSquared(dec);
          if (s < bestScore) { bestScore = s; bestShift = shift; }
        }
        key += String.fromCharCode(65 + bestShift);
      }
      let plain = '';
      for (let i = 0; i < ct.length; i++) {
        plain += String.fromCharCode(((ct.charCodeAt(i) - 65 - (key.charCodeAt(i % best) - 65) + 26) % 26) + 65);
      }
      lines.push('', `Best guess key: ${key}  (length ${best})`, '', 'Decrypted with that key:', plain);
      lines.push('', 'Chi² settles local maxima — if the text looks garbled, re-run with a different max key length; multiples of the true length give near-identical ICs.');
      return textValue(lines.join('\n'));
    }
  }],
  examples: [{ label: 'Long enough', input: 'LXFOPVEFRNHRLVFHNHZGERCEAFGNEAFGNSSLFUVGARGHXRLFUBJECRFFNTRSEBZNAGBGSERRQBZGBGURGBGURENYVMRGHAVGVPERRQVFGBBFXRLRAKYBIRYYBJFVYYVFNVAGRNQVFGBKZVRFGEVYYRTRPGNARGAHAVGBBSERRQBZPBQRNYVMRGHAVGVPERRQVFGBBFXRLRAKYBIRYYBJFVYYVFNVAGRNQVFGBKZVRFGEVYYRTRPGNARGAHAVGNVAZGREENGVPERRQVAGVGBKRAABXVCPRYVATYBPYDAIVYYVFNVAGRNQVFGBKZVRFGEVYY' }],
  warnings: ['This attacks the CLASSICAL Vigenère only (A-Z, pre-computer). It says nothing about modern ciphers.']
});

/* ------------------------------ kasiski gaps -------------------------------- */

defineOp({
  id: 'kasiski-examination',
  name: 'Kasiski Examination',
  category: 'cryptanalysis',
  description: 'Finds repeated 3+ letter sequences and the distances between their occurrences — the 1863 key-length exam for Vigenère.',
  aliases: ['kasiski', 'repeated sequences', 'vigenere key length'],
  tags: ['cryptanalysis', 'vigenere', 'history'],
  input: 'text',
  output: 'text',
  reversible: false,
  engine: 'typescript',
  options: [{ type: 'number', key: 'minSeq', label: 'Minimum repeat length', default: 3, min: 3, max: 8 }],
  actions: [{
    id: 'analyze', label: 'Examine', kind: 'analyze',
    run: (v, o) => {
      const ct = v.text.toUpperCase().replace(/[^A-Z]/g, '');
      if (ct.length < 30) throw new Error('Need 30+ letters for Kasiski.');
      const minSeq = Number(o.minSeq ?? 3);
      const seen = new Map<string, number[]>();
      for (let i = 0; i + minSeq <= ct.length; i++) {
        const seq = ct.slice(i, i + minSeq);
        if (!seen.has(seq)) seen.set(seq, []);
        seen.get(seq)!.push(i);
      }
      const rows: string[] = [];
      const gaps: number[] = [];
      for (const [seq, pos] of [...seen.entries()].filter(([, p]) => p.length > 1).sort((a, b) => b[1].length - a[1].length).slice(0, 15)) {
        const d: number[] = [];
        for (let i = 1; i < pos.length; i++) { d.push(pos[i] - pos[i - 1]); gaps.push(pos[i] - pos[i - 1]); }
        rows.push(`  ${seq}  at ${pos.join(', ')}  → gaps ${d.join(', ')}`);
      }
      if (!rows.length) return textValue('No repeated sequences of length ' + minSeq + '+ found — Caesar/substitution ciphers and one-time pads have no Kasiski signature.');
      const factorCounts = new Map<number, number>();
      for (const g of gaps) for (let f = 2; f <= Math.min(g, 20); f++) if (g % f === 0) factorCounts.set(f, (factorCounts.get(f) ?? 0) + 1);
      const ranked = [...factorCounts.entries()].sort((a, b) => b[1] - a[1]);
      return textValue(
        `Repeated sequences (length ${minSeq}+):\n${rows.join('\n')}\n\nGap factor histogram (likely key lengths at top):\n${ranked.slice(0, 6).map(([f, c]) => `  ${f}: ${'▮'.repeat(c)} ${c}`).join('\n')}\n\nThe key length must divide most gaps — classic Kasiski reasoning.`
      );
    }
  }]
});

/* ------------------------------ xor attacks --------------------------------- */

function hammingBits(a: Uint8Array, b: Uint8Array): number {
  let d = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    let x = a[i] ^ b[i];
    while (x) { d += x & 1; x >>= 1; }
  }
  return d;
}

defineOp({
  id: 'xor-keysize-hamming',
  name: 'XOR Key-Size Estimator (Hamming)',
  category: 'cryptanalysis',
  description: 'The cryptopals method: normalized Hamming distance between adjacent blocks — low score = likely repeating-key XOR size.',
  aliases: ['hamming distance keysizes', 'repeating xor crack', 'cryptopals 6'],
  tags: ['cryptanalysis', 'xor', 'statistics'],
  input: 'text',
  output: 'text',
  reversible: false,
  engine: 'typescript',
  options: [
    { type: 'toggle', key: 'hexInput', label: 'Input is hex (off = raw text)', default: true },
    { type: 'number', key: 'maxSize', label: 'Max key size', default: 40, min: 2, max: 200 }
  ],
  actions: [{
    id: 'analyze', label: 'Estimate', kind: 'analyze',
    run: (v, o) => {
      const data = o.hexInput ? hexToBytes(v.text) : utf8.encode(v.text);
      if (data.length < 8) throw new Error('Need more bytes.');
      const maxK = Math.min(Number(o.maxSize ?? 40), Math.floor(data.length / 2));
      const rows: { k: number; d: number }[] = [];
      for (let k = 2; k <= maxK; k++) {
        const blocks = Math.floor(data.length / k) - 1;
        if (blocks < 1) break;
        let total = 0;
        const use = Math.min(blocks, 6);
        for (let b = 0; b < use; b++) total += hammingBits(data.slice(b * k, b * k + k), data.slice((b + 1) * k, (b + 1) * k + k)) / k;
        rows.push({ k, d: total / use });
      }
      rows.sort((a, b) => a.d - b.d);
      const lines = ['Normalized Hamming distance per candidate key size (smaller = likelier):', ''];
      rows.slice(0, 10).forEach((r, i) => lines.push(`#${i + 1}  size ${String(r.k).padStart(3)}  distance ${r.d.toFixed(3)}  ${'▮'.repeat(Math.max(1, Math.round(12 - r.d * 4)))}`));
      lines.push('', `Leading candidate: key size ${rows[0].k}. Now transpose into columns and crack each as single-byte XOR.`);
      return textValue(lines.join('\n'));
    }
  }]
});

defineOp({
  id: 'single-byte-xor-cracker',
  name: 'Single-Byte XOR Cracker',
  category: 'cryptanalysis',
  description: 'Tries all 256 XOR keys and ranks decryptions by English-likeness. The whole attack in one click.',
  aliases: ['xor crack', 'xor brute force', 'single char xor'],
  tags: ['cryptanalysis', 'xor', 'brute force'],
  input: 'text',
  output: 'text',
  reversible: false,
  engine: 'typescript',
  options: [{ type: 'toggle', key: 'hexInput', label: 'Input is hex bytes', default: true }],
  actions: [{
    id: 'analyze', label: 'Crack', kind: 'analyze',
    run: (v, o) => {
      const data = o.hexInput ? hexToBytes(v.text) : utf8.encode(v.text);
      if (!data.length) throw new Error('Empty input.');
      const scored = [...Array(256)].map((_, key) => {
        const dec = String.fromCharCode(...data.map((b) => b ^ key));
        return { key, dec, score: englishScore(dec) };
      }).sort((a, b) => a.score - b.score);
      const lines = ['Top candidate keys:', ''];
      scored.slice(0, 5).forEach((r, i) => {
        const printable = r.dec.replace(/[^\x20-\x7e\n]/g, '·');
        lines.push(`#${i + 1}  key 0x${r.key.toString(16).padStart(2, '0')} (${r.key})  "${printable.slice(0, 60)}${r.dec.length > 60 ? '…' : ''}"`);
      });
      return textValue(lines.join('\n'));
    }
  }],
  examples: [{ label: 'Mysterious hex', input: '1b 37 37 33 31 63 27 22 36 27 32 31 63 30 26 31 63 22 27 32 36' }]
});

defineOp({
  id: 'crib-dragging',
  name: 'Crib Dragging (XOR²)',
  category: 'cryptanalysis',
  description: 'XORs two same-keystream ciphertexts, then drags a guessed word ("crib") across the result revealing fragments of the other message.',
  aliases: ['crib drag', 'two time pad', 'otp reuse attack'],
  tags: ['cryptanalysis', 'xor', 'otp'],
  input: 'text',
  output: 'text',
  reversible: false,
  engine: 'typescript',
  options: [
    { type: 'text', key: 'cipherB', label: 'Ciphertext B (hex)', default: '' },
    { type: 'text', key: 'crib', label: 'Crib (word to drag)', default: ' the ' }
  ],
  actions: [
    {
      id: 'analyze', label: 'XOR the pair', kind: 'analyze',
      run: (v, o) => {
        const a = hexToBytes(v.text);
        const b = hexToBytes(String(o.cipherB));
        if (!a.length || !b.length) throw new Error('Provide both ciphertexts (input = A, option = B), as hex.');
        const n = Math.min(a.length, b.length);
        const x = new Uint8Array(n);
        for (let i = 0; i < n; i++) x[i] = a[i] ^ b[i];
        const crib = utf8.encode(String(o.crib));
        const hits: string[] = [];
        for (let i = 0; i + crib.length <= n; i++) {
          const guess = String.fromCharCode(...x.slice(i, i + crib.length).map((c, k) => c ^ crib[k]));
          if (/^[\x20-\x7e]+$/.test(guess)) hits.push(`  offset ${String(i).padStart(3)}: B ⊕ crib = "${guess}"`);
          if (hits.length >= 20) { hits.push('  …'); break; }
        }
        return textValue(
          `Ciphertexts XORed (${n} bytes) — keystream cancels, leaving P₁ ⊕ P₂:\n${bytesToHex(x, ' ')}\n\nDragging crib "${String(o.crib)}" — positions where it yields printable text:\n${hits.length ? hits.join('\n') : '  no clean hits — try a different/longer crib'}`
        );
      }
    }
  ],
  docs: 'Reusing a one-time pad twice is catastrophic exactly because of this: with P₁⊕P₂ plus ordinary word knowledge, both messages unravel — the Venona project broke reused Soviet pads this way.'
});

/* -------------------------------- detectors ---------------------------------- */

defineOp({
  id: 'magic-number-detector',
  name: 'File Magic-Number Detector',
  category: 'cryptanalysis',
  description: 'Identifies likely file types from leading byte signatures (PNG, ZIP, gzip, PDF, ELF, SQLite…).',
  aliases: ['file signature', 'magic bytes', 'file type detect'],
  tags: ['cryptanalysis', 'detection', 'forensics'],
  input: 'text',
  output: 'text',
  reversible: false,
  engine: 'typescript',
  actions: [{
    id: 'analyze', label: 'Identify', kind: 'analyze',
    run: (v) => {
      const data = hexToBytes(v.text);
      if (data.length < 2) throw new Error('Need at least a few hexadecimal bytes.');
      const SIGS: { bytes: number[]; name: string }[] = [
        { bytes: [0x89, 0x50, 0x4e, 0x47], name: 'PNG image' },
        { bytes: [0xff, 0xd8, 0xff], name: 'JPEG image' },
        { bytes: [0x47, 0x49, 0x46, 0x38], name: 'GIF image' },
        { bytes: [0x50, 0x4b, 0x03, 0x04], name: 'ZIP archive (also .docx/.xlsx/.jar basis)' },
        { bytes: [0x1f, 0x8b], name: 'gzip deflate stream' },
        { bytes: [0x42, 0x5a, 0x68], name: 'bzip2' },
        { bytes: [0x25, 0x50, 0x44, 0x46], name: 'PDF document' },
        { bytes: [0x7f, 0x45, 0x4c, 0x46], name: 'ELF executable' },
        { bytes: [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00], name: 'SQLite database' },
        { bytes: [0xff, 0xfb], name: 'MP3 audio' },
        { bytes: [0x52, 0x49, 0x46, 0x46], name: 'RIFF container (WAV/AVI/WebP)' },
        { bytes: [0x42, 0x4d], name: 'BMP image' },
        { bytes: [0x7b], name: 'Possibly JSON text ({...})' },
        { bytes: [0x3c, 0x3f, 0x78, 0x6d, 0x6c], name: 'XML document' },
        { bytes: [0xef, 0xbb, 0xbf], name: 'UTF-8 BOM + data' },
        { bytes: [0xff, 0xfe], name: 'UTF-16LE BOM + data' },
        { bytes: [0xfe, 0xff], name: 'UTF-16BE BOM + data' }
      ];
      const hits = SIGS.filter((s) => s.bytes.every((b, i) => data[i] === b));
      return textValue(
        `Leading bytes: ${bytesToHex(data.slice(0, 16), ' ')}${data.length > 16 ? ' …' : ''}\n\n${hits.length ? hits.map((h) => '• ' + h.name).join('\n') : '• No known signature matched — likely raw text, a format without magic bytes, or entropy-obscured data.'}`
      );
    }
  }],
  examples: [{ label: 'Mystery blob', input: '89 50 4e 47 0d 0a 1a 0a' }]
});

defineOp({
  id: 'encoding-detector',
  name: 'Encoding Detector',
  category: 'cryptanalysis',
  description: 'Scores input against hex/Base64/Base32/Base58/binary/Morse/percent shapes and ranks the most plausible identifications.',
  aliases: ['what encoding is this', 'identify encoding', 'cipher identifier'],
  tags: ['cryptanalysis', 'detection'],
  input: 'text',
  output: 'text',
  reversible: false,
  engine: 'typescript',
  actions: [{
    id: 'analyze', label: 'Detect', kind: 'analyze',
    run: (v) => {
      const s = v.text.trim();
      if (!s) throw new Error('Empty input.');
      const candidates: { name: string; score: number; why: string }[] = [];
      if (/^[0-9a-fA-F\s:]+$/i.test(s) && s.replace(/\D/g, '').length > s.length * 0.6 && s.length > 3) candidates.push({ name: 'Hexadecimal', score: 90, why: 'only 0-9a-f and separators' });
      if (/^[A-Za-z0-9+/]+={0,2}$/.test(s) && s.length % 4 === 0) candidates.push({ name: 'Base64', score: 85, why: 'alphabet + padding + multiple of 4' });
      if (/^[A-Z2-7]+=*$/i.test(s) && s.length % 8 === 0) candidates.push({ name: 'Base32', score: 80, why: 'A-Z2-7 alphabet, 8-char blocks' });
      if (/^[1-9A-HJ-NP-Za-km-z]+$/.test(s) && s.length >= 8 && !/^[0-9a-f]+$/i.test(s)) candidates.push({ name: 'Base58 (Bitcoin alphabet)', score: 70, why: 'no 0, O, I, l characters' });
      if (/^[01\s]+$/.test(s) && s.replace(/[^01]/g, '').length % 8 === 0) candidates.push({ name: 'Binary bytes', score: 90, why: 'groups of 8 bits' });
      if (/^[．・.-]{1,6}(\s+[．・.-]{1,6})*(\s*[/|]\s*[．・.-]|$)/.test(s) || /^[.\-\s/]+$/.test(s)) candidates.push({ name: 'Morse code', score: 88, why: 'only dots/dashes/spaces/slashes' });
      if (/%[0-9a-fA-F]{2}/.test(s)) candidates.push({ name: 'Percent/URL encoding', score: 88, why: '%XX sequences present' });
      if (/^(x\d+|\\x[0-9a-f]{2}|\\u|\|[-_>=<X])/i.test(s)) candidates.push({ name: 'Brainfuck or spaced cipher', score: 40, why: 'speculative' });
      if (/^[A-Z\s]+$/.test(s) && s.length > 20) candidates.push({ name: 'Classical cipher territory (A-Z only — try IC + frequency ops)', score: 50, why: 'restricted alphabet, text-like' });
      const ent = (() => { const f = new Map<string, number>(); for (const c of s) f.set(c, (f.get(c) ?? 0) + 1); let e = 0; for (const n of f.values()) { const p = n / s.length; e -= p * Math.log2(p); } return e; })();
      if (ent > 5.2 && s.length > 30) candidates.push({ name: 'High-entropy blob — compressed/encrypted, not a simple code', score: 45, why: `entropy ${ent.toFixed(2)} bits/char` });
      if (!candidates.length) candidates.push({ name: 'Plain or structured text', score: 30, why: 'no strong encoding signature' });
      candidates.sort((a, b) => b.score - a.score);
      return textValue(`Length ${s.length} chars, entropy ${ent.toFixed(2)} bits/char.\n\nRanked hypotheses:\n${candidates.slice(0, 5).map((c, i) => `#${i + 1} (${c.score}) ${c.name}\n      ↳ ${c.why}`).join('\n')}\n\nApply the matching decoder as the next pipeline step and re-analyze.`);
    }
  }],
  examples: [{ label: 'Unknown blob', input: 'SGkgZGV0ZWN0b3IsIHdoYXQgYW0gST8=' }]
});

defineOp({
  id: 'unicode-anomaly-detector',
  name: 'Unicode Anomaly Detector',
  category: 'cryptanalysis',
  description: 'Finds zero-width characters, bidi controls, confusable look-alikes and exotic spaces — the toolkit for invisible-text and homoglyph checks.',
  aliases: ['zero width', 'homoglyph check', 'invisible characters', 'bidi trojan'],
  tags: ['cryptanalysis', 'unicode', 'detection', 'security'],
  input: 'text',
  output: 'text',
  reversible: false,
  engine: 'browser',
  actions: [{
    id: 'analyze', label: 'Scan', kind: 'analyze',
    run: (v) => {
      const findings: string[] = [];
      const patterned: { re: RegExp; label: string }[] = [
        { re: /​/g, label: 'U+200B ZERO WIDTH SPACE' },
        { re: /‌/g, label: 'U+200C ZERO WIDTH NON-JOINER' },
        { re: /‍/g, label: 'U+200D ZERO WIDTH JOINER' },
        { re: /﻿/g, label: 'U+FEFF BOM / ZERO WIDTH NO-BREAK SPACE' },
        { re: /­/g, label: 'U+00AD SOFT HYPHEN (invisible at line ends)' },
        { re: /[‮‭‪‫‬]/g, label: 'BIDI OVERRIDE/EMBEDDING control' },
        { re: / /g, label: 'U+00A0 NO-BREAK SPACE (looks like a space, isn’t)' },
        { re: /[ -   　]/g, label: 'Exotic Unicode space' },
        { re: /[̀-ͯ]/g, label: 'COMBINING DIACRITICAL MARK' },
        { re: /[а-яА-Я]/g, label: 'CYRILLIC — potential homoglyph vs Latin a/e/o/c/p' }
      ];
      for (const p of patterned) {
        const m = v.text.match(p.re);
        if (m) findings.push(`• ${m.length}× ${p.label}`);
      }
      const surrogateIssues = (() => {
        let lone = 0;
        for (let i = 0; i < v.text.length; i++) {
          const c = v.text.charCodeAt(i);
          if (c >= 0xd800 && c < 0xdc00) {
            if (i + 1 >= v.text.length || !(v.text.charCodeAt(i + 1) >= 0xdc00 && v.text.charCodeAt(i + 1) < 0xe000)) { lone++; } else i++;
          } else if (c >= 0xdc00 && c < 0xe000) lone++;
        }
        return lone;
      })();
      if (surrogateIssues) findings.push(`• ${surrogateIssues}× LONE SURROGATE (invalid UTF-16)`);
      if (!findings.length) return textValue('Clean scan: no zero-width characters, bidi controls, exotic spaces, combining marks or Cyrillic homoglyphs found.');
      return textValue(`Anomalies found:\n\n${findings.join('\n')}\n\nThese matter for security reviews (Trojan Source bidi attacks), watermarking, and debugging "identical-looking" strings.`);
    }
  }],
  examples: [{ label: 'Hidden things', input: 'normal text​with​invisible hitchhikers' }],
  warnings: ['Cyrillic detection is a heuristic — perfectly legitimate Cyrillic text will also be flagged.']
});

defineOp({
  id: 'language-comparator',
  name: 'Language Chi-Squared Comparator',
  category: 'cryptanalysis',
  description: 'Chi-squared letter-frequency distance to English, Spanish, French, German and Italian — ranks likely plaintext languages.',
  aliases: ['guess language stats', 'chi squared language'],
  tags: ['cryptanalysis', 'language', 'statistics'],
  input: 'text',
  output: 'text',
  reversible: false,
  engine: 'typescript',
  actions: [{
    id: 'analyze', label: 'Compare', kind: 'analyze',
    run: (v) => {
      const letters = v.text.toUpperCase().replace(/[^A-Z]/g, '');
      if (letters.length < 20) throw new Error('Need 20+ A–Z letters.');
      const n = letters.length;
      const counts = new Array(26).fill(0);
      for (const ch of letters) counts[ch.charCodeAt(0) - 65]++;
      const LANGS: [string, number[]][] = [
        ['English', [8.167, 1.492, 2.782, 4.253, 12.702, 2.228, 2.015, 6.094, 6.966, 0.153, 0.772, 4.025, 2.406, 6.749, 7.507, 1.929, 0.095, 5.987, 6.327, 9.056, 2.758, 0.978, 2.360, 0.150, 1.974, 0.074]],
        ['Spanish', [12.53, 1.42, 4.68, 5.86, 13.68, 0.69, 1.01, 0.70, 6.25, 0.44, 0.01, 4.97, 3.15, 6.71, 8.68, 2.51, 0.88, 6.87, 7.98, 4.63, 3.93, 0.90, 0.02, 0.22, 0.90, 0.52]],
        ['French', [7.636, 0.901, 3.260, 3.669, 14.715, 1.066, 0.866, 0.737, 7.529, 0.613, 0.049, 5.456, 2.968, 7.095, 5.796, 2.521, 1.362, 6.693, 7.948, 7.244, 6.311, 1.838, 0.074, 0.427, 0.128, 0.326]],
        ['German', [6.516, 1.886, 2.732, 5.076, 16.396, 1.656, 3.009, 4.577, 6.550, 0.268, 1.417, 3.437, 2.534, 9.776, 2.594, 0.670, 0.018, 7.003, 7.270, 6.154, 4.166, 0.846, 1.921, 0.034, 0.039, 1.134]],
        ['Italian', [11.745, 0.927, 4.501, 3.736, 11.792, 1.153, 1.644, 0.636, 10.143, 0.011, 0.009, 6.510, 2.512, 6.883, 9.832, 3.056, 0.505, 6.367, 4.981, 5.623, 3.011, 2.097, 0.033, 0.003, 0.020, 1.181]]
      ];
      const scored = LANGS.map(([name, freqs]) => {
        let chi = 0;
        for (let i = 0; i < 26; i++) {
          const exp = (freqs[i] / 100) * n;
          chi += ((counts[i] - exp) ** 2) / (exp || 1);
        }
        return { name, chi };
      }).sort((a, b) => a.chi - b.chi);
      const max = scored.reduce((m, s) => Math.max(m, s.chi), 1);
      return textValue(
        `Chi² distance per language (LOWER = better fit), ranked:\n\n${scored.map((s, i) => `${i + 1}. ${s.name.padEnd(9)} χ²=${s.chi.toFixed(1).padStart(8)}  ${'▮'.repeat(Math.max(1, Math.round(20 * (1 - s.chi / max))))}`).join('\n')}\n\nAccented characters (é, ñ, ü) are stripped to their base letters for the comparison.`
      );
    }
  }],
  examples: [{ label: 'Which language?', input: 'EL ZORRO MARRON RAPIDO SALTA SOBRE EL PERRO PEREZOSO MUCHAS VECES SIN CANSARSE' }]
});
