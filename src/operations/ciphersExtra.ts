// Classical ciphers — second wave. Enigma M3 uses the real historical rotor
// wirings and stepping rules (verified against known test vectors). Solitaire
// implements Schneier's full 54-card algorithm. The last three ops (Chaocipher,
// progressive Alberti, wheel cipher) are EDUCATIONAL IMPLEMENTATIONS of
// historical designs and are labeled as such in their descriptions.
import { defineOp } from './core/registry';
import { textValue } from './core/types';

const A2Z = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const scrubAZ = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, '');

function keyedAlphabet(key: string): string {
  let out = '';
  for (const ch of key.toUpperCase() + A2Z) if (!out.includes(ch)) out += ch;
  return out;
}

function columnarOrder(key: number[]): number[] {
  return [...key.keys()].sort((a, b) => key[a] - key[b] || a - b);
}

/* --------------------------------- ADFGX ----------------------------------- */

function registerAdfg({ vx }: { vx: boolean }) {
  const header = vx ? 'ADFGVX' : 'ADFGX';
  const size = vx ? 6 : 5;
  const fill = vx ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' : 'ABCDEFGHIKLMNOPQRSTUVWXYZ'; // 5×5 merges J into I
  const name = `${header} Cipher`;
  const id = header.toLowerCase();

  const buildSquare = (key: string) => {
    const seen = new Set<string>();
    let sq = '';
    for (const ch of scrubAZ(key) + '0123456789' + fill) {
      const c = vx && /[0-9]/.test(ch) ? ch : ch.toUpperCase();
      const norm = !vx && c === 'J' ? 'I' : c;
      if (fill.includes(norm) && !seen.has(norm)) { seen.add(norm); sq += norm; }
      if (sq.length === size * size) break;
    }
    return sq;
  };

  const fractionate = (text: string, sq: string) => {
    const clean = vx
      ? text.toUpperCase().replace(/[^A-Z0-9]/g, '')
      : text.toUpperCase().replace(/J/g, 'I').replace(/[^A-Z]/g, '');
    let pairs = '';
    for (const ch of clean) {
      const i = sq.indexOf(ch);
      if (i < 0) throw new Error(`"${ch}" is not in the ${header} square.`);
      pairs += header[Math.floor(i / size)] + header[i % size];
    }
    return { pairs, clean };
  };

  const unFractionate = (pairs: string, sq: string) => {
    if (pairs.length % 2) throw new Error('Odd fraction count — ciphertext corrupt.');
    let out = '';
    for (let i = 0; i < pairs.length; i += 2) {
      const r = header.indexOf(pairs[i]);
      const c = header.indexOf(pairs[i + 1]);
      if (r < 0 || c < 0) throw new Error(`"${pairs.slice(i, i + 2)}" is not a ${header} digraph.`);
      out += sq[r * size + c];
    }
    return out;
  };

  defineOp({
    id,
    name,
    category: 'ciphers',
    historicalName: vx ? 'Fritz Nebel, 1918' : 'Fritz Nebel, 1917',
    description: vx
      ? 'WWI field cipher: 6×6 keyed square (letters + digits) fractionated through A D F G V X, then columnar-transposed. The pen-and-paper cipher that broke French cryptanalysts\' hearts.'
      : 'WWI field cipher: 5×5 keyed square (I/J merged) fractionated through A D F G X, then columnar-transposed. Letters only.',
    aliases: [id],
    tags: ['cipher', 'fractionation', 'transposition', 'ww1'],
    input: 'text',
    output: 'text',
    reversible: true,
    engine: 'typescript',
    options: [
      { type: 'text', key: 'squareKey', label: 'Square keyword', default: vx ? 'CIPHER' : 'BLETCHLEY' },
      { type: 'text', key: 'transKey', label: 'Transposition keyword', default: vx ? 'ENIGMA' : 'PARK' }
    ],
    actions: [
      {
        id: 'encipher', label: 'Encipher', kind: 'transform',
        run: (v, o) => {
          const sq = buildSquare(String(o.squareKey ?? (vx ? 'CIPHER' : 'BLETCHLEY')));
          const tKey = scrubAZ(String(o.transKey ?? 'PARK'));
          if (!tKey) throw new Error('Transposition keyword needs letters.');
          const { pairs } = fractionate(v.text, sq);
          const cols = tKey.length;
          const order = columnarOrder([...tKey].map((c) => c.charCodeAt(0)));
          // read columns in key order from a rows-filled grid
          let out = '';
          for (const col of order) {
            for (let r = 0; r * cols + col < pairs.length; r++) out += pairs[r * cols + col];
          }
          return textValue((out.match(new RegExp(`.{1,${vx ? 6 : 5}}`, 'g')) ?? []).join(' '), 'text');
        }
      },
      {
        id: 'decipher', label: 'Decipher', kind: 'transform',
        run: (v, o) => {
          const sq = buildSquare(String(o.squareKey ?? (vx ? 'CIPHER' : 'BLETCHLEY')));
          const tKey = scrubAZ(String(o.transKey ?? 'PARK'));
          const ct = v.text.toUpperCase().replace(new RegExp(`[^${header}]`, 'g'), '');
          const cols = tKey.length;
          const rows = Math.ceil(ct.length / cols);
          const shorts = cols * rows - ct.length; // number of short columns
          const order = columnarOrder([...tKey].map((c) => c.charCodeAt(0)));
          // short columns are the LAST `shorts` columns in reading (grid) order
          const grid: string[] = new Array(cols * rows).fill('');
          let p = 0;
          for (const col of order) {
            const len = rows - (col >= cols - shorts ? 1 : 0);
            for (let r = 0; r < len; r++) grid[r * cols + col] = ct[p++];
          }
          return textValue(unFractionate(grid.join(''), sq));
        }
      }
    ],
    examples: [{ label: 'WWI field message', input: vx ? 'ATTACK AT 1600' : 'ATTACKATDAWN' }],
    docs: vx
      ? 'Two-stage system: fractionate through the keyed 6×6, then columnar transposition by the second keyword. Painvin\'s breaking of ADFGVX in June 1918 is one of cryptanalysis\'s great feats.'
      : `Square layout is keyword + remaining letters; I/J share a cell. The fraction symbols ${header} were chosen for their distinct Morse rhythms.`
  });
}

registerAdfg({ vx: false });
registerAdfg({ vx: true });

/* ------------------------------- two-square --------------------------------- */

defineOp({
  id: 'two-square',
  name: 'Two-Square (Double Playfair)',
  category: 'ciphers',
  historicalName: 'late 19th century',
  description: 'Two keyed 5×5 squares side by side; plaintext digraphs map across the rectangle corners. J merges with I.',
  aliases: ['double playfair', 'two square cipher'],
  tags: ['cipher', 'digraph', 'polygraphic'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'typescript',
  options: [
    { type: 'text', key: 'key1', label: 'Left square key', default: 'EXAMPLE' },
    { type: 'text', key: 'key2', label: 'Right square key', default: 'KEYWORD' }
  ],
  actions: [
    {
      id: 'encipher', label: 'Encipher', kind: 'transform',
      run: (v, o) => twoSquare(v.text, String(o.key1), String(o.key2), true)
    },
    {
      id: 'decipher', label: 'Decipher', kind: 'transform',
      run: (v, o) => twoSquare(v.text, String(o.key1), String(o.key2), false)
    }
  ],
  examples: [{ label: 'Digraph demo', input: 'HELLO WORLD' }],
  docs: 'Convention: if the two letters share a row they are SWAPPED (the standard invertible rule); otherwise the ciphertext pair takes the rectangle\'s opposite corners (letter A\u2019s row / letter B\u2019s column in the right square, then B\u2019s row / A\u2019s column in the left). X pads an odd final letter.'
});

function twoSquare(text: string, key1: string, key2: string, encrypt: boolean) {
  const sq1 = keyedAlphabet(key1 || 'A').replace(/J/g, '');
  const sq2raw = keyedAlphabet(key2 || 'B').replace(/J/g, '');
  if (sq1.length < 25 || sq2raw.length < 25) throw new Error('Square build failed.');
  const s1 = sq1.slice(0, 25);
  const s2 = sq2raw.slice(0, 25);
  let clean = scrubAZ(text).replace(/J/g, 'I');
  if (encrypt && clean.length % 2) clean += 'X';
  if (clean.length % 2) throw new Error('Two-square needs an even letter count.');
  const pos = (sq: string, c: string) => [Math.floor(sq.indexOf(c) / 5), sq.indexOf(c) % 5] as const;
  let out = '';
  for (let i = 0; i < clean.length; i += 2) {
    const [a, b] = encrypt ? [clean[i], clean[i + 1]] : [clean[i], clean[i + 1]];
    if (encrypt) {
      const [r1, c1] = pos(s1, a);
      const [r2, c2] = pos(s2, b);
      if (r1 === r2) out += b + a; // same row: swap (self-inverse and unambiguous)
      else out += s2[r1 * 5 + c2] + s1[r2 * 5 + c1];
    } else {
      // ciphertext chars: first lives in s2, second in s1
      const [r1, c1] = pos(s2, a);
      const [r2, c2] = pos(s1, b);
      if (r1 === r2) out += b + a; // swap back
      else out += s1[r1 * 5 + c2] + s2[r2 * 5 + c1];
    }
  }
  return textValue(out.match(/.{1,5}/g)!.join(' '), 'text');
}

/* --------------------------------- route cipher ------------------------------ */

function routeIndices(w: number, h: number, mode: string): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  if (mode === 'spiral') {
    let top = 0, bottom = h - 1, left = 0, right = w - 1;
    while (top <= bottom && left <= right) {
      for (let c = left; c <= right; c++) out.push(top * w + c);
      for (let r = top + 1; r <= bottom; r++) out.push(r * w + right);
      if (top < bottom) for (let c = right - 1; c >= left; c--) out.push(bottom * w + c);
      if (left < right) for (let r = bottom - 1; r > top; r--) out.push(r * w + left);
      top++; bottom--; left++; right--;
    }
  } else if (mode === 'serpentine-cols') {
    for (let c = 0; c < w; c++) {
      if (c % 2 === 0) for (let r = 0; r < h; r++) out.push(r * w + c);
      else for (let r = h - 1; r >= 0; r--) out.push(r * w + c);
    }
  } else {
    for (let r = 0; r < h; r++) {
      if (r % 2 === 0) for (let c = 0; c < w; c++) out.push(r * w + c);
      else for (let c = w - 1; c >= 0; c--) out.push(r * w + c);
    }
  }
  return out.filter((i) => { if (seen.has(i)) return false; seen.add(i); return true; });
}

defineOp({
  id: 'route-cipher',
  name: 'Route Cipher',
  category: 'ciphers',
  description: 'Write the text into a grid row by row; read it out along a spiral or serpentine path. A pure transposition.',
  aliases: ['serpentine cipher', 'spiral cipher', 'grid route'],
  tags: ['cipher', 'transposition'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'typescript',
  options: [
    { type: 'select', key: 'mode', label: 'Route', default: 'spiral', options: [
      { value: 'spiral', label: 'Spiral (clockwise inward)' },
      { value: 'serpentine-cols', label: 'Serpentine columns' },
      { value: 'serpentine-rows', label: 'Serpentine rows' }
    ] },
    { type: 'number', key: 'width', label: 'Grid width', default: 5, min: 2, max: 40 }
  ],
  actions: [
    {
      id: 'encipher', label: 'Encipher', kind: 'transform',
      run: (v, o) => {
        const w = Number(o.width ?? 5);
        const text = v.text.replace(/\n/g, ' ');
        const h = Math.ceil(text.length / w);
        const grid = text.padEnd(w * h, '·');
        const idx = routeIndices(w, h, String(o.mode));
        return textValue(idx.map((i) => grid[i]).join(''), 'text');
      }
    },
    {
      id: 'decipher', label: 'Decipher', kind: 'transform',
      run: (v, o) => {
        const w = Number(o.width ?? 5);
        const text = v.text;
        const h = Math.ceil(text.length / w);
        if (w * h !== text.length) throw new Error(`Input length ${text.length} doesn\'t fill a ${w}-wide grid — include any · padding.`);
        const idx = routeIndices(w, h, String(o.mode));
        const grid = new Array<string>(w * h);
        for (let i = 0; i < idx.length; i++) grid[idx[i]] = text[i];
        return textValue(grid.join('').replace(/·+$/, ''));
      }
    }
  ],
  examples: [{ label: 'Grid', input: 'THE ROUTE IS THE MESSAGE ITSELF', options: { width: 5 } }],
  docs: 'Padding uses · (middle dot) so grid edges are visible; it is stripped on decipher. Classical field routes agreed on path + width out-of-band.'
});

/* -------------------------------- myszkowski -------------------------------- */

defineOp({
  id: 'myszkowski',
  name: 'Myszkowski Transposition',
  category: 'ciphers',
  historicalName: 'Émile Myszkowski, 1902',
  description: 'Columnar transposition where REPEATED key letters are read simultaneously row-wise — the twist that made its keyword ambiguity famous.',
  aliases: ['myszkowski cipher'],
  tags: ['cipher', 'transposition'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'typescript',
  options: [{ type: 'text', key: 'key', label: 'Keyword (with a repeated letter, ideally)', default: 'TELEPHONE' }],
  actions: [
    {
      id: 'encipher', label: 'Encipher', kind: 'transform',
      run: (v, o) => {
        const key = scrubAZ(String(o.key ?? 'TELEPHONE'));
        if (!key) throw new Error('Keyword needed.');
        const text = scrubAZ(v.text);
        const cols = key.length;
        const rows = Math.ceil(text.length / cols);
        const grid = text.padEnd(rows * cols, 'X');
        // groups: same letter handled together, visited in alphabetical order of the letter
        const letters = [...new Set([...key])].sort();
        let out = '';
        for (const L of letters) {
          const colsFor = [...key].map((c, i) => c === L ? i : -1).filter((i) => i >= 0);
          if (colsFor.length === 1) {
            for (let r = 0; r < rows; r++) out += grid[r * cols + colsFor[0]];
          } else {
            for (let r = 0; r < rows; r++) for (const c of colsFor) out += grid[r * cols + c];
          }
        }
        return textValue(out.match(/.{1,5}/g)!.join(' '), 'text');
      }
    },
    {
      id: 'decipher', label: 'Decipher', kind: 'transform',
      run: (v, o) => {
        const key = scrubAZ(String(o.key ?? 'TELEPHONE'));
        const ct = scrubAZ(v.text);
        const cols = key.length;
        const rows = Math.ceil(ct.length / cols);
        if (rows * cols !== ct.length) throw new Error('Myszkowski ciphertext must exactly fill the grid (X-padded on encipher).');
        const grid = new Array<string>(rows * cols).fill('');
        let p = 0;
        const letters = [...new Set([...key])].sort();
        for (const L of letters) {
          const colsFor = [...key].map((c, i) => c === L ? i : -1).filter((i) => i >= 0);
          for (let r = 0; r < rows; r++) for (const c of colsFor) grid[r * cols + c] = ct[p++];
        }
        return textValue(grid.join('').replace(/X+$/, ''));
      }
    }
  ],
  examples: [{ label: 'With repeats', input: 'CIVILIZATION' }],
  docs: 'Encipher pads with X; decipher strips trailing Xs. The pair-read rule applies ONLY to repeated key letters — classic Myszkowski.'
});

/* --------------------------------- enigma M3 -------------------------------- */

const ENIGMA_ROTORS: Record<string, { wiring: string; notch: string }> = {
  I: { wiring: 'EKMFLGDQVZNTOWYHXUSPAIBRCJ', notch: 'Q' },
  II: { wiring: 'AJDKSIRUXBLHWTMCQGZNPYFVOE', notch: 'E' },
  III: { wiring: 'BDFHJLCPRTXVZNYEIWGAKMUSQO', notch: 'V' },
  IV: { wiring: 'ESOVPZJAYQUIRHXLNFTGKDCMWB', notch: 'J' },
  V: { wiring: 'VZBRGITYUPSDNHLXAWMJQOFECK', notch: 'Z' }
};
const ENIGMA_REFLECTORS: Record<string, string> = {
  B: 'YRUHQSLDPXNGOKMIEBFZCWVJAT',
  C: 'FVPJIAOYEDRZXWGCTKUQSBNMHL'
};

function enigmaRun(
  text: string,
  rotorNames: string[],
  positions: string,
  rings: string,
  reflector: string
): string {
  const rotors = rotorNames.map((n) => {
    const r = ENIGMA_ROTORS[n];
    if (!r) throw new Error(`Unknown rotor "${n}". Choose among I, II, III, IV, V.`);
    return r;
  });
  const fwd = rotors.map((r) => r.wiring);
  const bwd = rotors.map((r) => {
    const inv = new Array(26).fill('A');
    for (let i = 0; i < 26; i++) inv[r.wiring.charCodeAt(i) - 65] = String.fromCharCode(65 + i);
    return inv.join('');
  });
  const notches = rotors.map((r) => r.notch.charCodeAt(0) - 65);
  const refl = ENIGMA_REFLECTORS[reflector];
  if (!refl) throw new Error('Reflector must be B or C.');
  let pos = [positions.charCodeAt(0) - 65, positions.charCodeAt(1) - 65, positions.charCodeAt(2) - 65];
  const ring = [rings.charCodeAt(0) - 65, rings.charCodeAt(1) - 65, rings.charCodeAt(2) - 65];
  const clean = scrubAZ(text);
  let out = '';
  for (const ch of clean) {
    // stepping: right always; middle if right at notch; left+middle if middle at notch (double step)
    if (pos[1] === notches[1]) { pos[1] = (pos[1] + 1) % 26; pos[0] = (pos[0] + 1) % 26; }
    else if (pos[2] === notches[2]) { pos[1] = (pos[1] + 1) % 26; }
    pos[2] = (pos[2] + 1) % 26;
    // signal right → left (rotor index 2,1,0), reflector, left → right
    let c = ch.charCodeAt(0) - 65;
    for (let i = 2; i >= 0; i--) {
      const off = pos[i] - ring[i];
      c = (fwd[i].charCodeAt((c + off + 26) % 26) - 65 - off + 26) % 26;
    }
    c = refl.charCodeAt(c) - 65;
    for (let i = 0; i <= 2; i++) {
      const off = pos[i] - ring[i];
      c = (bwd[i].charCodeAt((c + off + 26) % 26) - 65 - off + 26) % 26;
    }
    out += String.fromCharCode(65 + c);
  }
  return out;
}

defineOp({
  id: 'enigma-m3',
  name: 'Enigma M3 (Wehrmacht)',
  category: 'ciphers',
  historicalName: '1930s–1945',
  description: 'The real 3-rotor machine: historical wirings I–V, UKW-B/C, ring settings and double-stepping all implemented. Self-inverse, like the original.',
  aliases: ['enigma', 'enigma machine', 'enigma m3'],
  tags: ['cipher', 'rotor machine', 'ww2', 'machine cipher'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'typescript',
  options: [
    { type: 'select', key: 'rotorL', label: 'Left rotor', default: 'I', options: ['I', 'II', 'III', 'IV', 'V'].map((r) => ({ value: r, label: r })) },
    { type: 'select', key: 'rotorM', label: 'Middle rotor', default: 'II', options: ['I', 'II', 'III', 'IV', 'V'].map((r) => ({ value: r, label: r })) },
    { type: 'select', key: 'rotorR', label: 'Right rotor', default: 'III', options: ['I', 'II', 'III', 'IV', 'V'].map((r) => ({ value: r, label: r })) },
    { type: 'text', key: 'positions', label: 'Start positions (3 letters)', default: 'AAA' },
    { type: 'text', key: 'rings', label: 'Ring settings (3 letters)', default: 'AAA' },
    { type: 'select', key: 'reflector', label: 'Reflector', default: 'B', options: [{ value: 'B', label: 'UKW-B' }, { value: 'C', label: 'UKW-C' }] }
  ],
  actions: [{
    id: 'run', label: 'Run machine', kind: 'transform',
    run: (v, o) => {
      const rotors = [String(o.rotorL), String(o.rotorM), String(o.rotorR)];
      if (new Set(rotors).size !== 3) throw new Error('The three rotors must be distinct — there was only one of each per machine.');
      const positions = scrubAZ(String(o.positions ?? 'AAA')).padEnd(3, 'A').slice(0, 3);
      const rings = scrubAZ(String(o.rings ?? 'AAA')).padEnd(3, 'A').slice(0, 3);
      if (positions.length !== 3 || rings.length !== 3) throw new Error('Positions and rings need exactly 3 letters.');
      const out = enigmaRun(v.text, rotors, positions, rings, String(o.reflector));
      return textValue(out.match(/.{1,5}/g)!.join(' '), 'text');
    }
  }],
  examples: [{ label: 'Test vector', input: 'AAAAA' }],
  docs: 'Self-inverse: running ciphertext through with the SAME settings returns the plaintext. Sanity check: I-II-III at AAA/AAA turns AAAAA into BDZGO. Plugboard (Steckerbrett) is not simulated.',
  warnings: ['Historic interest only — Enigma was broken operationally by 1940. It offers zero modern security.']
});

/* --------------------------------- solitaire --------------------------------- */

type Deck = number[];

function solitaireStep(deck: Deck): void {
  // 1. Joker A (53) down one; if it was the bottom card it goes below the top card
  let i = deck.indexOf(53);
  deck.splice(i, 1);
  let j1 = i + 1;
  if (j1 > deck.length) j1 = 1;
  deck.splice(j1, 0, 53);
  // 2. Joker B (54) down two, same circular-wrap rule
  i = deck.indexOf(54);
  deck.splice(i, 1);
  let j2 = i + 2;
  if (j2 > deck.length) j2 -= deck.length;
  deck.splice(j2, 0, 54);
  // 3. Triple cut
  const a = deck.indexOf(53), b = deck.indexOf(54);
  const first = Math.min(a, b), last = Math.max(a, b);
  const top = deck.slice(0, first), mid = deck.slice(first, last + 1), bot = deck.slice(last + 1);
  const cut = [...bot, ...mid, ...top];
  deck.splice(0, deck.length, ...cut);
  // 4. Count cut (bottom card value, jokers = 53)
  const v = Math.min(deck[deck.length - 1], 53);
  const head = deck.slice(0, v);
  const rest = deck.slice(v, deck.length - 1);
  deck.splice(0, deck.length, ...rest, ...head, deck[deck.length - 1]);
}

function solitaireKeyStream(deck: Deck, n: number): number[] {
  const out: number[] = [];
  while (out.length < n) {
    solitaireStep(deck);
    const v = Math.min(deck[0], 53);
    const card = deck[v];
    if (card < 53) out.push(card);
  }
  return out;
}

defineOp({
  id: 'solitaire-cipher',
  name: 'Solitaire (Pontifex)',
  category: 'ciphers',
  historicalName: 'Bruce Schneier, 1999',
  description: 'The hand cipher Neal Stephenson\'s Cryptonomicon made famous: a keyed deck of 54 cards generates the keystream. Full algorithm, no shortcuts.',
  aliases: ['pontifex', 'solitaire cipher', 'card cipher'],
  tags: ['cipher', 'modern-hand-cipher', 'schneier'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'typescript',
  options: [{ type: 'text', key: 'passphrase', label: 'Passphrase (empty = natural-order deck)', default: '' }],
  actions: [
    {
      id: 'encipher', label: 'Encipher', kind: 'transform',
      run: (v, o) => {
        const deck: Deck = Array.from({ length: 54 }, (_, i) => i + 1);
        keyDeck(deck, String(o.passphrase ?? ''));
        const clean = scrubAZ(v.text);
        if (!clean) throw new Error('Solitaire works on A–Z letters.');
        const ks = solitaireKeyStream(deck, clean.length);
        let out = '';
        for (let i = 0; i < clean.length; i++) {
          const p = clean.charCodeAt(i) - 65;
          const k = ks[i] % 26;
          out += String.fromCharCode(65 + ((p + k) % 26));
        }
        return textValue(out.match(/.{1,5}/g)!.join(' '), 'text');
      }
    },
    {
      id: 'decipher', label: 'Decipher', kind: 'transform',
      run: (v, o) => {
        const deck: Deck = Array.from({ length: 54 }, (_, i) => i + 1);
        keyDeck(deck, String(o.passphrase ?? ''));
        const clean = scrubAZ(v.text);
        const ks = solitaireKeyStream(deck, clean.length);
        let out = '';
        for (let i = 0; i < clean.length; i++) {
          const c = clean.charCodeAt(i) - 65;
          const k = ks[i] % 26;
          out += String.fromCharCode(65 + ((c - k + 26) % 26));
        }
        return textValue(out.match(/.{1,5}/g)!.join(' '));
      }
    },
    {
      id: 'keystream', label: 'Show keystream', kind: 'analyze',
      run: (v, o) => {
        const deck: Deck = Array.from({ length: 54 }, (_, i) => i + 1);
        keyDeck(deck, String(o.passphrase ?? ''));
        const n = Math.min(Math.max(v.text.trim() ? Number(v.text.trim()) : 20, 1), 200);
        if (!Number.isFinite(n)) throw new Error('Enter the number of keystream letters to show (e.g. 20).');
        const ks = solitaireKeyStream(deck, n);
        return textValue(
          `Card values: ${ks.join(' ')}\nKeystream:   ${ks.map((k) => String.fromCharCode(64 + ((k - 1) % 26) + 1)).join('')}\n\nUnkeyed deck sanity check: first ten card values are 4, 49, 10, 53, 24, 8, 51, 44, 6, 4.`
        );
      }
    }
  ],
  examples: [{ label: 'Schneier vector', input: 'AAAAAAAAAA' }],
  docs: 'Test vector: unkeyed deck, plaintext AAAAAAAAAA → EXKYI ZSGEH. Passphrase keying performs the full per-letter ritual from Schneier\'s description.',
  warnings: ['Strong for a hand cipher, obsolete against computers. Use it to LEARN, not to protect anything.']
});

function keyDeck(deck: Deck, passphrase: string) {
  for (const ch of scrubAZ(passphrase)) {
    solitaireStep(deck);
    const v = ch.charCodeAt(0) - 64;
    const head = deck.slice(0, v);
    const rest = deck.slice(v, deck.length - 1);
    deck.splice(0, deck.length, ...rest, ...head, deck[deck.length - 1]);
  }
}

/* ------------------------- educational implementations ------------------------ */

defineOp({
  id: 'chaocipher-edu',
  name: 'Chaocipher (educational)',
  category: 'ciphers',
  historicalName: 'John F. Byrne, 1918',
  description: 'EDUCATIONAL implementation of Byrne\'s two-alphabet machine: both alphabets permute every letter per the published algorithm. Default alphabets are the ones disclosed to the NSA in 2010.',
  aliases: ['chaocipher'],
  tags: ['cipher', 'educational', 'machine cipher'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'typescript',
  options: [
    { type: 'text', key: 'leftAlphabet', label: 'Cipher (left) alphabet', default: 'HXUCZVAMDSLKPEFJRIGTWOBNYQ' },
    { type: 'text', key: 'rightAlphabet', label: 'Plain (right) alphabet', default: 'PTLNBQDEOYSFAVZKGJRIHWXUMC' }
  ],
  actions: [
    {
      id: 'encipher', label: 'Encipher', kind: 'transform',
      run: (v, o) => chaoRun(v.text, String(o.leftAlphabet), String(o.rightAlphabet), true)
    },
    {
      id: 'decipher', label: 'Decipher', kind: 'transform',
      run: (v, o) => chaoRun(v.text, String(o.leftAlphabet), String(o.rightAlphabet), false)
    }
  ],
  examples: [{ label: 'Byrne alphabets', input: 'WELLDONEISBETTERTHANWELLSAID' }],
  warnings: [
    'EDUCATIONAL IMPLEMENTATION: the published permutation steps are followed, but no large independent test corpus exists; treat results as a simulation of the mechanism, not a guaranteed drop-in replacement for a historical machine.'
  ]
});

function chaoPermuteLeft(alph: string, cipherChar: string): string {
  // rotate so cipherChar is at zenith (0); move char at 1 → 13
  const a = [...alph];
  const idx = a.indexOf(cipherChar);
  const rot = [...a.slice(idx), ...a.slice(0, idx)];
  const ch = rot.splice(1, 1)[0];
  rot.splice(13, 0, ch);
  return rot.join('');
}

function chaoPermuteRight(alph: string, plainChar: string): string {
  // rotate so plainChar at zenith, rotate one more, move char at 2 → 13
  const a = [...alph];
  const idx = a.indexOf(plainChar);
  let rot = [...a.slice(idx), ...a.slice(0, idx)];
  rot = [...rot.slice(1), rot[0]];
  const ch = rot.splice(2, 1)[0];
  rot.splice(13, 0, ch);
  return rot.join('');
}

function chaoRun(text: string, leftIn: string, rightIn: string, encrypt: boolean) {
  const clean = scrubAZ(text);
  let left = scrubAZ(leftIn);
  let right = scrubAZ(rightIn);
  if (left.length !== 26 || right.length !== 26 || new Set(left).size !== 26 || new Set(right).size !== 26)
    throw new Error('Each alphabet must be a permutation of A–Z (26 distinct letters).');
  let out = '';
  for (const ch of clean) {
    if (encrypt) {
      const i = right.indexOf(ch);
      out += left[i];
      left = chaoPermuteLeft(left, left[i]);
      right = chaoPermuteRight(right, ch);
    } else {
      const i = left.indexOf(ch);
      out += right[i];
      left = chaoPermuteLeft(left, ch);
      right = chaoPermuteRight(right, right[i]);
    }
  }
  return textValue(encrypt ? out.match(/.{1,5}/g)!.join(' ') : out);
}

defineOp({
  id: 'alberti-progressive',
  name: 'Alberti Progressive Disk (educational)',
  category: 'ciphers',
  historicalName: 'Leon Battista Alberti, 1467',
  description: 'EDUCATIONAL teaching variant: Alberti\'s mixed inner disk advances ONE step per letter (progressive polyalphabetic ≈ Trithemius with a keyed alphabet).',
  aliases: ['alberti disk', 'cipher disk progressive'],
  tags: ['cipher', 'educational', 'polyalphabetic', 'renaissance'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'typescript',
  options: [{ type: 'text', key: 'innerKey', label: 'Inner-disk keyword (mixed alphabet)', default: 'ALBERTI' }],
  actions: [
    {
      id: 'encipher', label: 'Encipher', kind: 'transform',
      run: (v, o) => alberti(v.text, String(o.innerKey), true)
    },
    {
      id: 'decipher', label: 'Decipher', kind: 'transform',
      run: (v, o) => alberti(v.text, String(o.innerKey), false)
    }
  ],
  examples: [{ label: 'Renaissance', input: 'FROM THE DAWN OF CRYPTOGRAPHY' }],
  docs: 'Letter i encrypts with the inner disk rotated i steps from alignment. Alberti\'s real innovation was switching the index letter MID-message at agreed cues ("index letters" within the text) — this progressive variant is the standard classroom simplification.',
  warnings: ['EDUCATIONAL VARIANT — a simplification of the historical protocol, clearly not Alberti\'s capital-letter index-switching.']
});

function alberti(text: string, innerKey: string, encrypt: boolean) {
  const inner = keyedAlphabet(scrubAZ(innerKey) || 'A');
  const clean = scrubAZ(text);
  let out = '';
  for (let i = 0; i < clean.length; i++) {
    const p = clean.charCodeAt(i) - 65;
    if (encrypt) out += inner[(p + i) % 26];
    else {
      const idx = inner.indexOf(clean[i]);
      out += String.fromCharCode(65 + ((idx - i + 26 * 40) % 26));
    }
  }
  return textValue(encrypt ? out.match(/.{1,5}/g)!.join(' ') : out);
}

defineOp({
  id: 'wheel-cipher',
  name: 'Jefferson Wheel Cipher (educational)',
  category: 'ciphers',
  historicalName: 'Thomas Jefferson, ~1795',
  description: 'EDUCATIONAL simulation: 26 virtual wheels with shuffled alphabets; plaintext aligns on one row, ciphertext is read N rows below. Same device family as the US M-94.',
  aliases: ['jefferson cylinder', 'm-94', 'bazeries cylinder'],
  tags: ['cipher', 'educational', 'polyalphabetic'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'typescript',
  options: [
    { type: 'text', key: 'wheelKey', label: 'Wheel-order keyword', default: 'MONTICELLO' },
    { type: 'number', key: 'offset', label: 'Rows below to read cipher', default: 7, min: 1, max: 25 }
  ],
  actions: [
    {
      id: 'encipher', label: 'Encipher', kind: 'transform',
      run: (v, o) => wheel(v.text, String(o.wheelKey), Number(o.offset ?? 7), true)
    },
    {
      id: 'decipher', label: 'Decipher', kind: 'transform',
      run: (v, o) => wheel(v.text, String(o.wheelKey), Number(o.offset ?? 7), false)
    }
  ],
  examples: [{ label: 'Cylinder', input: 'THE WHEELS TURN AND TURN' }],
  docs: 'Wheels are 26 keyed alphabets, one per plaintext position (message is padded to 26 with X if short — the real device had 25/36 wheels). Historically the sender picked ANY row that looked legible as decoy; this op uses a fixed offset so decryption is deterministic. EDUCATIONAL.',
  warnings: ['EDUCATIONAL SIMULATION — historical wheel orderings are lost/variable; this uses a reproducible keyword-derived arrangement.']
});

function wheel(text: string, key: string, offset: number, encrypt: boolean) {
  const alphs: string[] = [];
  let seedSource = key.toUpperCase() || 'WHEEL';
  for (let w = 0; w < 26; w++) {
    let a = keyedAlphabet(seedSource + A2Z.slice(w) + A2Z.slice(0, w));
    alphs.push(a);
    seedSource = a[0] + seedSource.slice(0, 25);
  }
  let clean = scrubAZ(text);
  if (encrypt && clean.length > 26) throw new Error('Wheel cipher messages are capped at one wheel row (26 letters) in this educational version.');
  if (encrypt) clean = clean.padEnd(26, 'X');
  if (clean.length % 26 !== 0) throw new Error('Ciphertext must be 26 letters (the padded wheel row).');
  let out = '';
  for (let w = 0; w < 26; w++) {
    if (encrypt) {
      const p = clean.charCodeAt(w) - 65;
      // aligned plaintext at row = position p in the wheel's alphabet; read `offset` below
      out += alphs[w][(p + offset) % 26];
    } else {
      const idx = alphs[w].indexOf(clean[w]);
      out += String.fromCharCode(65 + ((idx - offset + 26) % 26));
    }
  }
  return textValue(encrypt ? out : out.replace(/X+$/, ''), 'text');
}
