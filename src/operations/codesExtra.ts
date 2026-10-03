// Codes & representations — second wave: telegraph variants, signalling
// systems, legacy encodings, and machine-level representations.
import { defineOp } from './core/registry';
import { textValue } from './core/types';
import { utf8, bytesToHex, hexToBytes } from '../utils/bytes';

/* ----------------------------- NATO phonetic ------------------------------ */

const NATO: [string, string][] = [
  ['A', 'Alfa'], ['B', 'Bravo'], ['C', 'Charlie'], ['D', 'Delta'], ['E', 'Echo'], ['F', 'Foxtrot'],
  ['G', 'Golf'], ['H', 'Hotel'], ['I', 'India'], ['J', 'Juliett'], ['K', 'Kilo'], ['L', 'Lima'],
  ['M', 'Mike'], ['N', 'November'], ['O', 'Oscar'], ['P', 'Papa'], ['Q', 'Quebec'], ['R', 'Romeo'],
  ['S', 'Sierra'], ['T', 'Tango'], ['U', 'Uniform'], ['V', 'Victor'], ['W', 'Whiskey'],
  ['X', 'X-ray'], ['Y', 'Yankee'], ['Z', 'Zulu'],
  ['0', 'Zero'], ['1', 'One'], ['2', 'Two'], ['3', 'Three'], ['4', 'Four'],
  ['5', 'Five'], ['6', 'Six'], ['7', 'Seven'], ['8', 'Eight'], ['9', 'Nine']
];

defineOp({
  id: 'nato-phonetic',
  name: 'NATO Phonetic Alphabet',
  category: 'codes',
  description: 'ICAO spelling alphabet: letters spelled as Alfa, Bravo, Charlie… for unambiguous voice transmission.',
  aliases: ['phonetic alphabet', 'icao', 'spelling alphabet', 'alfa bravo'],
  tags: ['code', 'voice', 'radio'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'typescript',
  actions: [
    {
      id: 'encode', label: 'Spell out', kind: 'convert',
      run: (v) => {
        const map = new Map(NATO);
        const words: string[] = [];
        for (const ch of v.text.toUpperCase()) {
          if (ch === ' ') { words.push('/'); continue; }
          const w = map.get(ch);
          if (!w) throw new Error(`NATO alphabet covers A–Z and 0–9. Unsupported: "${ch}"`);
          words.push(w);
        }
        return textValue(words.join(' '));
      }
    },
    {
      id: 'decode', label: 'Read back', kind: 'convert',
      run: (v) => {
        const rev = new Map(NATO.map(([c, w]) => [w.toUpperCase(), c]));
        let out = '';
        for (const tok of v.text.trim().split(/\s+/)) {
          if (tok === '/') { out += ' '; continue; }
          const ch = rev.get(tok.toUpperCase());
          if (!ch) throw new Error(`"${tok}" is not a NATO codeword (Alfa…Zulu, Zero…Nine) or "/".`);
          out += ch;
        }
        return textValue(out);
      }
    }
  ],
  examples: [{ label: 'Callsign', input: 'VK-26' }]
});

/* ------------------------- maritime signal flags --------------------------- */

const MARITIME: [string, string, string][] = [
  ['A', 'Alfa', 'white/blue swallowtail'], ['B', 'Bravo', 'red swallowtail'],
  ['C', 'Charlie', 'blue-white-blue-white-blue horizontal stripes'], ['D', 'Delta', 'yellow-blue-yellow horizontal'],
  ['E', 'Echo', 'blue over red horizontal'], ['F', 'Foxtrot', 'white diamond on red'],
  ['G', 'Golf', 'yellow/blue vertical stripes'], ['H', 'Hotel', 'white/red vertical halves'],
  ['I', 'India', 'black ball on yellow'], ['J', 'Juliett', 'blue-white-blue horizontal'],
  ['K', 'Kilo', 'yellow/red vertical halves'], ['L', 'Lima', 'quartered yellow and black'],
  ['M', 'Mike', 'white saltire on blue'], ['N', 'November', 'blue/white checkered'],
  ['O', 'Oscar', 'yellow/red diagonal halves'], ['P', 'Papa', 'white square in blue'],
  ['Q', 'Quebec', 'solid yellow'], ['R', 'Romeo', 'yellow cross on red'],
  ['S', 'Sierra', 'blue square in white'], ['T', 'Tango', 'red-white-blue vertical thirds'],
  ['U', 'Uniform', 'quartered red and white'], ['V', 'Victor', 'red saltire on white'],
  ['W', 'Whiskey', 'nested blue-white-red squares'], ['X', 'X-ray', 'blue cross on white'],
  ['Y', 'Yankee', 'red/yellow diagonal stripes'], ['Z', 'Zulu', 'diagonal quarters yellow, blue, red, black']
];

defineOp({
  id: 'maritime-flags',
  name: 'International Maritime Signal Flags',
  category: 'codes',
  description: 'Textual registry of the ICS single-letter flags: letter → flag name and visual description, and back.',
  aliases: ['signal flags', 'ics flags', 'nautical flags', 'maritime'],
  tags: ['code', 'signal', 'visual', 'nautical'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'typescript',
  actions: [
    {
      id: 'encode', label: 'Hoist flags', kind: 'convert',
      run: (v) => {
        const map = new Map(MARITIME.map(([c, n, d]) => [c, `[${n}] ${d}`]));
        const out: string[] = [];
        for (const ch of v.text.toUpperCase()) {
          if (ch === ' ') { out.push('— space —'); continue; }
          const f = map.get(ch);
          if (!f) throw new Error(`Maritime signal flags: letters A–Z only. Unsupported: "${ch}"`);
          out.push(f);
        }
        return textValue(out.join('\n'));
      }
    },
    {
      id: 'decode', label: 'Read flags', kind: 'convert',
      run: (v) => {
        const rev = new Map(MARITIME.map(([c, n]) => [n.toUpperCase(), c]));
        const matches = v.text.match(/\[[A-Za-z]+\]/g);
        if (!matches) throw new Error('No [FlagName] tokens found. Expected form: [Alfa] …');
        return textValue(matches.map((m) => {
          const ch = rev.get(m.slice(1, -1).toUpperCase());
          if (!ch) throw new Error(`"${m}" is not a maritime signal-flag name.`);
          return ch;
        }).join(''));
      }
    }
  ],
  examples: [{ label: 'Ahoy', input: 'AHOY' }],
  docs: 'Flags are rendered as accessible text (name + description of the actual flag design) — the physical flags themselves are visual objects.'
});

/* ------------------------- american (railroad) morse ---------------------- */

// Long dash (L, 0): L = longer dash; 0 = an even longer one, per convention.
const AMORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '.. .', D: '-..', E: '.', F: '.-.', G: '--.', H: '....',
  I: '..', J: '-.-.', K: '-.-', L: '–', M: '--', N: '-.', O: '. .', P: '.....',
  Q: '..-.', R: '. ..', S: '...', T: '-', U: '..-', V: '...-', W: '.--',
  X: '.-..', Y: '.. ..', Z: '... .',
  '1': '.--.', '2': '..-..', '3': '...-.', '4': '....', '5': '---', '6': '......',
  '7': '--..', '8': '-....', '9': '-..-', '0': '—',
  '.': '..--..', ',': '.-.-', '?': '-..-.'
};

defineOp({
  id: 'american-morse',
  name: 'American Morse Code',
  category: 'codes',
  historicalName: 'Railroad Morse (1844)',
  description: 'The original U.S. telegraph code — differs from International Morse (O, C, R, Y, Z use internal gaps; L and 0 are long dashes).',
  aliases: ['railroad morse', 'american morse', 'original morse'],
  tags: ['code', 'telegraph', 'historical'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    {
      id: 'encode', label: 'Encode', kind: 'encode',
      run: (v) => {
        const out: string[] = [];
        for (const ch of v.text.toUpperCase()) {
          if (ch === ' ') { out.push('//'); continue; }
          const code = AMORSE[ch];
          if (!code) throw new Error(`American Morse: unsupported character "${ch}".`);
          out.push(code);
        }
        return textValue(out.join(' / '), 'encoded');
      }
    },
    {
      id: 'decode', label: 'Decode', kind: 'decode',
      run: (v) => {
        const rev: Record<string, string> = Object.fromEntries(Object.entries(AMORSE).map(([k, c]) => [c, k]));
        let out = '';
        for (const word of v.text.split('//')) {
          for (const tok of word.split('/').map((s) => s.trim()).filter(Boolean)) {
            const ch = rev[tok];
            if (!ch) throw new Error(`"${tok}" is not a known American Morse sequence (letters separated by " / ", L = "–", 0 = "—").`);
            out += ch;
          }
          out += ' ';
        }
        return textValue(out.trim());
      }
    }
  ],
  examples: [{ label: 'Railroad', input: 'LOCOMOTIVE 10' }],
  docs: 'Conventions used here: letters separated by " / ", the internal gaps of C/O/R/Y/Z kept as spaces inside their token, L = "–" (long dash) and 0 = "—" (extra-long dash), words separated by "//".'
});

/* ---------------------------------- wabun ---------------------------------- */

const WABUN: [string, string][] = [
  ['ア', '--.--'], ['イ', '.-'], ['ウ', '..-'], ['エ', '-.---'], ['オ', '.-...'],
  ['カ', '.-..'], ['キ', '-.-..'], ['ク', '...-'], ['ケ', '-.--'], ['コ', '----'],
  ['サ', '-.-.-'], ['シ', '--.-.'], ['ス', '---.-'], ['セ', '.---.'], ['ソ', '---.'],
  ['タ', '-.'], ['チ', '..-.'], ['ツ', '.--.'], ['テ', '.-.--'], ['ト', '..-..'],
  ['ナ', '.-.'], ['ニ', '-.-.'], ['ヌ', '....'], ['ネ', '--.-'], ['ノ', '..--'],
  ['ハ', '-...'], ['ヒ', '--..-'], ['フ', '--..'], ['ヘ', '.'], ['ホ', '-..'],
  ['マ', '-..-'], ['ミ', '..-.-'], ['ム', '-'], ['メ', '-...-'], ['モ', '-..-.'],
  ['ヤ', '.--'], ['ユ', '-..--'], ['ヨ', '--'],
  ['ラ', '...'], ['リ', '--.'], ['ル', '-.--.'], ['レ', '---'], ['ロ', '.-.-'],
  ['ワ', '-.-'], ['ヰ', '.-..-'], ['ヱ', '.--..'], ['ヲ', '.---'], ['ン', '.-.-.'],
  ['゛', '..'], ['゜', '..--.']
];

defineOp({
  id: 'wabun-code',
  name: 'Wabun Code',
  category: 'codes',
  historicalName: 'Wabun Mōrusu (Japanese Morse)',
  description: 'Japanese telegraph code for katakana, including dakuten ゛ and handakuten ゜ marks. Hiragana must be converted to katakana first.',
  aliases: ['wabun', 'japanese morse', 'kana morse'],
  tags: ['code', 'telegraph', 'japanese', 'historical'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    {
      id: 'encode', label: 'Encode', kind: 'encode',
      run: (v) => {
        const map = new Map(WABUN);
        const out: string[] = [];
        for (const ch of v.text) {
          if (ch === ' ' || ch === '　') { out.push('//'); continue; }
          const code = map.get(ch);
          if (!code) throw new Error(`Wabun covers katakana only. Unsupported: "${ch}"`);
          out.push(code);
        }
        return textValue(out.join(' / '), 'encoded');
      }
    },
    {
      id: 'decode', label: 'Decode', kind: 'decode',
      run: (v) => {
        const rev = new Map(WABUN.map(([k, c]) => [c, k]));
        let out = '';
        for (const word of v.text.split('//')) {
          for (const tok of word.split('/').map((s) => s.trim()).filter(Boolean)) {
            const ch = rev.get(tok);
            if (!ch) throw new Error(`"${tok}" is not a Wabun sequence.`);
            out += ch;
          }
          out += ' ';
        }
        return textValue(out.trim());
      }
    }
  ],
  examples: [{ label: 'Kana', input: 'ニホン' }],
  docs: 'Dakuten/handakuten are sent as separate code groups following the kana group (".." and "..--.").'
});

/* ------------------------------ morse prosigns ----------------------------- */

const PROSIGNS: Record<string, string> = {
  SOS: '...---...', AR: '.-.-.', BT: '-...-', SK: '...-.-', SN: '...-.',
  AS: '.-...', AA: '.-.-', BK: '-...-.-', KN: '-.--.', CL: '-.-.-..', HH: '........'
};
const PROSIGN_MEANINGS: Record<string, string> = {
  SOS: 'distress', AR: 'end of message', BT: 'break / new section', SK: 'end of contact',
  SN: 'understood', AS: 'wait', AA: 'new line', BK: 'break (invite transmit)',
  KN: 'over — named station only', CL: 'closing station', HH: 'error (8 dots)'
};

defineOp({
  id: 'morse-prosigns',
  name: 'Morse Prosigns',
  category: 'codes',
  description: 'Procedural signals sent run-together (no letter gap): SOS, AR, BT, SK, KN… Write [SOS], [AR] to collide letters.',
  aliases: ['prosign', 'procedural signal', 'over and out'],
  tags: ['code', 'telegraph', 'signal'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    {
      id: 'encode', label: 'Encode', kind: 'encode',
      run: (v) => {
        const MORSE_CH: Record<string, string> = {
          A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
          K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
          U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
          '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....',
          '6': '-....', '7': '--...', '8': '---..', '9': '----.'
        };
        const out: string[] = [];
        const re = /\[([A-Z]+)\]|(\s+)|([\s\S])/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(v.text)) !== null) {
          if (m[1]) {
            const code = PROSIGNS[m[1].toUpperCase()];
            if (!code) throw new Error(`Unknown prosign [${m[1]}]. Known: ${Object.keys(PROSIGNS).map((k) => '[' + k + ']').join(' ')}`);
            out.push(code + `   ⟦${m[1].toUpperCase()} — ${PROSIGN_MEANINGS[m[1].toUpperCase()]}⟧`);
          } else if (m[2]) out.push('       (word space)');
          else {
            const code = MORSE_CH[m[3].toUpperCase()];
            if (!code) throw new Error(`Unsupported character "${m[3]}" — letters, digits, spaces, and [prosigns].`);
            out.push(code);
          }
        }
        return textValue(out.join('\n'), 'encoded');
      }
    },
    {
      id: 'decode', label: 'Decode', kind: 'decode',
      run: (v) => {
        const revPro = new Map(Object.entries(PROSIGNS).map(([k, c]) => [c, k]));
        const REV: Record<string, string> = {};
        const plain = { ...Object.fromEntries(Object.entries(PROSIGNS).map(([k, c]) => [c, `[${k}]`])) };
        const MORSE_CH: Record<string, string> = {
          A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
          K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
          U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..'
        };
        for (const [c, ch] of Object.entries(MORSE_CH)) REV[c] = ch;
        let out = '';
        for (const line of v.text.split('\n')) {
          const token = line.split(' ')[0];
          if (!token.trim()) continue;
          if (line.includes('word space')) { out += ' '; continue; }
          if (revPro.has(token)) { out += plain[token]; continue; }
          const ch = REV[token];
          if (!ch) throw new Error(`"${token}" is neither a letter sequence nor a known prosign.`);
          out += ch;
        }
        return textValue(out);
      }
    }
  ],
  examples: [{ label: 'Mayday', input: '[SOS] CQ [AR]' }],
  docs: 'A prosign is letters sent with NO inter-letter gap — that is what makes …---… one signal rather than S-O-S. Meanings are labeled per line in the encoder output.'
});

/* ------------------------------ dancing men -------------------------------- */

// Letters attested by the actual Doyle canon (from NEVER, ABE SLANEY, ELSIE,
// "PREPARE TO MEET THY GOD", COME, etc.).
const DM_ATTESTED = 'ABCDEGHILMNOPRSTVY';

defineOp({
  id: 'dancing-men',
  name: 'Dancing Men (Doyle canon)',
  category: 'codes',
  historicalName: 'The Adventure of the Dancing Men (1903)',
  description: 'Sherlock Holmes\' stick-figure substitution as an accessible token form: ⟦A⟧⟦B⟧… Only the canon-attested letters are encodable.',
  aliases: ['dancing men cipher', 'sherlock cipher', 'holmes figures'],
  tags: ['code', 'historical', 'puzzle', 'sherlock'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    {
      id: 'encode', label: 'Encode', kind: 'encode',
      run: (v) => {
        const out: string[] = [];
        for (const ch of v.text.toUpperCase()) {
          if (ch === ' ') { out.push('⟦⚑⟧'); continue; }
          if (!DM_ATTESTED.includes(ch)) throw new Error(`"${ch}" has no attested figure in the published stories. Attested set: ${DM_ATTESTED.split('').join(' ')}`);
          out.push(`⟦${ch}⟧`);
        }
        return textValue(out.join(''), 'encoded');
      }
    },
    {
      id: 'decode', label: 'Decode', kind: 'decode',
      run: (v) => {
        const tokens = v.text.match(/⟦.⟧/g);
        if (!tokens || tokens.length === 0) throw new Error('No ⟦X⟧ figure tokens found.');
        return textValue(tokens.map((t) => {
          const ch = t[1];
          if (ch === '⚑') return ' ';
          if (!DM_ATTESTED.includes(ch)) throw new Error(`⟦${ch}⟧ is not an attested Dancing Men figure.`);
          return ch;
        }).join(''));
      }
    }
  ],
  examples: [{ label: 'Story word', input: 'NEVER' }],
  docs: 'Doyle drew arbitrary body shapes, so there IS no definitive glyph font: this encoder uses the labeled-token convention (⟦N⟧ = the N figure, ⟦⚑⟧ = the flag-bearer that marks word ends). Encoding is restricted to letters with attested figures in the published canon; the rest are reported, never invented.',
  warnings: ['On-its-own this is a labeled representation, not a reversal of Doyle\'s artwork — decode reads the token form this encoder produces.']
});

/* --------------------------------- pigpen ---------------------------------- */

const PIGPEN_GRID = ['┘', '⊔', '└', '⊐', '□', '⊏', '┐', '⊓', '┌'];
const PIGPEN_X = ['∨', '<', '∧', '>']; // S T U V = top, left, bottom, right wedge

function pigpenGlyph(ch: string): string {
  const i = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(ch);
  if (i < 9) return PIGPEN_GRID[i];
  if (i < 18) return PIGPEN_GRID[i - 9] + '·';
  if (i < 22) return PIGPEN_X[i - 18];
  return PIGPEN_X[i - 22] + '·';
}

defineOp({
  id: 'pigpen',
  name: 'Pigpen Cipher',
  category: 'codes',
  historicalName: 'Masonic / Freemason cipher',
  description: 'The tic-tac-toe grid cipher, rendered with real box-drawing glyphs: A=┘ E=□ J=┐· … plus the two X grids.',
  aliases: ['masonic cipher', 'freemason cipher', 'tic tac toe cipher', 'rosicrucian'],
  tags: ['cipher', 'historical', 'symbols', 'puzzle'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    {
      id: 'encode', label: 'Encode', kind: 'encode',
      run: (v) => {
        const out: string[] = [];
        for (const ch of v.text.toUpperCase()) {
          if (ch === ' ') { out.push('/'); continue; }
          if (ch < 'A' || ch > 'Z') throw new Error(`Pigpen covers A–Z. Unsupported: "${ch}"`);
          out.push(pigpenGlyph(ch));
        }
        return textValue(out.join(' '), 'encoded');
      }
    },
    {
      id: 'decode', label: 'Decode', kind: 'decode',
      run: (v) => {
        const rev = new Map<string, string>();
        for (let i = 0; i < 26; i++) rev.set(pigpenGlyph('ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i]), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i]);
        let out = '';
        for (const tok of v.text.trim().split(/\s+/)) {
          if (tok === '/') { out += ' '; continue; }
          const ch = rev.get(tok);
          if (ch === undefined) throw new Error(`"${tok}" is not a pigpen glyph produced by this encoder.`);
          out += ch;
        }
        return textValue(out);
      }
    }
  ],
  examples: [{ label: 'Mason', input: 'SECRET' }],
  docs: 'Grid convention: two 3×3 grids (second dotted), then two X grids (second dotted). S,T,U,V map to top, left, bottom, right X-wedges (∨ < ∧ >). Variants exist — this encoder documents its exact convention.',
  warnings: ['Pure symbol substitution with no key — classical, breakable by inspection.']
});

/* ---------------------------------- EBCDIC --------------------------------- */

const EBCDIC_MAP: [string, number][] = [
  [' ', 0x40],
  ...[...'ABCDEFGHI'].map((c, i) => [c, 0xc1 + i] as [string, number]),
  ...[...'JKLMNOPQR'].map((c, i) => [c, 0xd1 + i] as [string, number]),
  ...[...'STUVWXYZ'].map((c, i) => [c, 0xe2 + i] as [string, number]),
  ...[...'abcdefghi'].map((c, i) => [c, 0x81 + i] as [string, number]),
  ...[...'jklmnopqr'].map((c, i) => [c, 0x91 + i] as [string, number]),
  ...[...'stuvwxyz'].map((c, i) => [c, 0xa2 + i] as [string, number]),
  ...[...'0123456789'].map((c, i) => [c, 0xf0 + i] as [string, number]),
  ['.', 0x4b], ['<', 0x4c], ['(', 0x4d], ['+', 0x4e], ['|', 0x4f], ['&', 0x50],
  ['!', 0x5a], ['$', 0x5b], ['*', 0x5c], [')', 0x5d], [';', 0x5e], ['^', 0x5f],
  ['-', 0x60], ['/', 0x61], [',', 0x6b], ['%', 0x6c], ['_', 0x6d], ['>', 0x6e],
  ['?', 0x6f], ['`', 0x79], [':', 0x7a], ['#', 0x7b], ['@', 0x7c], ["'", 0x7d],
  ['=', 0x7e], ['"', 0x7f]
];

defineOp({
  id: 'ebcdic',
  name: 'EBCDIC Conversion (CP037)',
  category: 'codes',
  historicalName: 'EBCDIC — IBM mainframes (1963)',
  description: 'IBM mainframe character encoding: text ↔ EBCDIC code-page-037 bytes. Letters do NOT line up with ASCII — that\'s the point.',
  aliases: ['ebcdic 037', 'ibm encoding', 'cp037', 'mainframe'],
  tags: ['code', 'legacy', 'bytes', 'mainframe'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    {
      id: 'encode', label: 'To EBCDIC hex', kind: 'convert',
      run: (v) => {
        const map = new Map(EBCDIC_MAP);
        const bytes: number[] = [];
        for (const ch of v.text) {
          const b = map.get(ch);
          if (b === undefined) throw new Error(`No CP037 mapping for "${ch}" in the supported printable set.`);
          bytes.push(b);
        }
        return textValue(bytesToHex(new Uint8Array(bytes)), 'encoded');
      }
    },
    {
      id: 'decode', label: 'From EBCDIC hex', kind: 'convert',
      run: (v) => {
        const rev = new Map(EBCDIC_MAP.map(([c, b]) => [b, c]));
        const bytes = hexToBytes(v.text);
        let out = '';
        for (const b of bytes) {
          const ch = rev.get(b);
          if (ch === undefined) throw new Error(`0x${b.toString(16).padStart(2, '0')} is outside the supported printable CP037 set.`);
          out += ch;
        }
        return textValue(out);
      }
    }
  ],
  examples: [{ label: 'Mainframe', input: 'HELLO 123' }],
  docs: '"HELLO" in ASCII is 48 65 6C 6C 6F; in EBCDIC it is C8 C5 D3 D3 D6. Only the printable CP037 set is mapped.'
});

/* ------------------------- utf-16 / utf-32 views ---------------------------- */

defineOp({
  id: 'utf16-inspector',
  name: 'UTF-16 Code-Unit Inspector',
  category: 'codes',
  description: 'Per-character view of UTF-16: code points below U+10000 are one 16-bit unit; above, a surrogate pair.',
  aliases: ['utf16', 'surrogate pairs inspector', 'utf-16'],
  tags: ['unicode', 'utf-16', 'analysis'],
  input: 'text',
  output: 'text',
  reversible: false,
  engine: 'typescript',
  actions: [
    {
      id: 'analyze', label: 'Inspect', kind: 'analyze',
      run: (v) => {
        const lines = ['CHAR | CODE POINT | UTF-16 UNITS (BE)', '-----+------------+----------------'];
        for (const ch of [...v.text]) {
          const cp = ch.codePointAt(0)!;
          const units: string[] = [];
          for (let i = 0; i < ch.length; i++) units.push(ch.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase());
          const shown = ch === ' ' ? '␣' : ch;
          lines.push(`${shown.padEnd(4)} | U+${cp.toString(16).toUpperCase().padStart(4, '0').padEnd(5)} | ${units.join(' ')}${units.length === 2 ? '  ← surrogate pair' : ''}`);
        }
        return textValue(lines.join('\n'));
      }
    }
  ],
  examples: [{ label: 'Beyond BMP', input: 'Aé汉🙂' }]
});

defineOp({
  id: 'utf32-representation',
  name: 'UTF-32 Representation',
  category: 'codes',
  description: 'Text as fixed 32-bit big-endian code-point values (00000041 per character) and back.',
  aliases: ['utf32', 'utf-32', '32-bit unicode'],
  tags: ['unicode', 'utf-32', 'representation'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    {
      id: 'encode', label: 'To UTF-32 hex', kind: 'convert',
      run: (v) => textValue([...v.text].map((ch) => ch.codePointAt(0)!.toString(16).toUpperCase().padStart(8, '0')).join(' '), 'encoded')
    },
    {
      id: 'decode', label: 'From UTF-32 hex', kind: 'convert',
      run: (v) => {
        const toks = v.text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
        return textValue(toks.map((t) => {
          if (!/^[0-9a-fA-F]{1,8}$/.test(t)) throw new Error(`"${t}" is not a 1–8 hex-digit UTF-32 value.`);
          const cp = parseInt(t, 16);
          if (cp > 0x10ffff) throw new Error(`${t} exceeds the Unicode maximum U+10FFFF.`);
          return String.fromCodePoint(cp);
        }).join(''));
      }
    }
  ],
  examples: [{ label: 'A€🙂', input: 'A€🙂' }]
});

/* --------------------------- octal escape sequences ------------------------ */

defineOp({
  id: 'octal-escapes',
  name: 'Octal Escape Sequences',
  category: 'codes',
  description: 'C-style octal byte escapes: A → \\101. Decode restores text from \\ooo sequences.',
  aliases: ['octal escape', '\\101', 'c octal'],
  tags: ['code', 'octal', 'escapes', 'c'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    {
      id: 'encode', label: 'Escape', kind: 'convert',
      run: (v) => textValue(Array.from(utf8.encode(v.text), (b) => '\\' + b.toString(8).padStart(3, '0')).join(''), 'encoded')
    },
    {
      id: 'decode', label: 'Unescape', kind: 'convert',
      run: (v) => {
        const matches = v.text.match(/\\[0-7]{1,3}/g);
        if (!matches) throw new Error('No \\ooo octal escapes found.');
        const bytes = new Uint8Array(matches.map((m) => {
          const n = parseInt(m.slice(1), 8);
          if (n > 255) throw new Error(`${m} exceeds one byte.`);
          return n;
        }));
        return textValue(utf8.decodeStrict(bytes));
      }
    }
  ],
  examples: [{ label: 'Hi', input: 'Hi' }]
});

/* ------------------------- bcd / gray / excess-3 --------------------------- */

defineOp({
  id: 'bcd',
  name: 'BCD (Binary-Coded Decimal)',
  category: 'codes',
  description: 'Each decimal digit packed as its own 4-bit nibble (8421 code): 42 → 0100 0010.',
  aliases: ['binary coded decimal', '8421', 'packed decimal'],
  tags: ['code', 'binary', 'digits', 'hardware'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    {
      id: 'encode', label: 'Encode', kind: 'encode',
      run: (v) => {
        const digits = v.text.replace(/\s+/g, '');
        if (!/^[0-9]+$/.test(digits)) throw new Error('BCD input must be decimal digits.');
        return textValue([...digits].map((d) => Number(d).toString(2).padStart(4, '0')).join(' '), 'encoded');
      }
    },
    {
      id: 'decode', label: 'Decode', kind: 'decode',
      run: (v) => {
        const bits = v.text.replace(/[^01]/g, '');
        if (!bits || bits.length % 4) throw new Error('BCD bits must come in 4-bit nibbles.');
        let out = '';
        for (let i = 0; i < bits.length; i += 4) {
          const n = parseInt(bits.slice(i, i + 4), 2);
          if (n > 9) throw new Error(`Nibble ${bits.slice(i, i + 4)} (${n}) is not a valid BCD digit.`);
          out += String(n);
        }
        return textValue(out);
      }
    }
  ],
  examples: [{ label: 'Year', input: '2026' }]
});

/* ------------------------- gray code / excess-3 --------------------------- */

defineOp({
  id: 'gray-code',
  name: 'Gray Code',
  category: 'codes',
  description: 'Reflected binary code where consecutive values differ by exactly one bit: G = n ⊕ (n ≫ 1). Used in rotary encoders and K-maps.',
  aliases: ['reflected binary', 'gray', 'grey code'],
  tags: ['code', 'binary', 'hardware'],
  input: 'any',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  options: [
    { type: 'select', key: 'inputMode', label: 'Input is…', default: 'decimal', options: [
      { value: 'decimal', label: 'Decimal numbers (space-separated)' },
      { value: 'hex', label: 'Hexadecimal bytes' }
    ] }
  ],
  actions: [
    {
      id: 'encode', label: 'Binary → Gray', kind: 'convert',
      run: (v, o) => {
        if (String(o.inputMode) === 'hex') {
          const bytes = hexToBytes(v.text);
          const gray = Uint8Array.from(bytes, (b) => b ^ (b >>> 1));
          return textValue(Array.from(gray, (b) => b.toString(2).padStart(8, '0')).join(' '), 'encoded');
        }
        const toks = v.text.trim().split(/\s+/);
        return textValue(toks.map((t) => {
          const n = Number(t);
          if (!Number.isInteger(n) || n < 0) throw new Error(`"${t}" is not a non-negative integer.`);
          const g = n ^ (n >>> 1);
          return g.toString(2).padStart(Math.max(1, n.toString(2).length), '0');
        }).join(' '), 'encoded');
      }
    },
    {
      id: 'decode', label: 'Gray → Binary', kind: 'convert',
      run: (v) => {
        const toks = v.text.trim().split(/\s+/);
        return textValue(toks.map((t) => {
          if (!/^[01]+$/.test(t)) throw new Error(`"${t}" is not a binary string.`);
          let g = parseInt(t, 2), n = g;
          while (g >>>= 1) n ^= g;
          return String(n);
        }).join(' '));
      }
    }
  ],
  examples: [{ label: '0-15', input: '0 1 2 3 4 5 6 7' }],
  docs: 'Gray decode applies prefix-XOR: each bit is XORed with all bits to its left (iterative shift-XOR).'
});

defineOp({
  id: 'excess3',
  name: 'Excess-3 Code',
  category: 'codes',
  description: 'Self-complementing decimal code: each digit encoded as (d+3) in 4 bits — 5 → 1000.',
  aliases: ['xs-3', 'xs3', 'stibitz code'],
  tags: ['code', 'binary', 'digits', 'hardware'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    {
      id: 'encode', label: 'Encode', kind: 'encode',
      run: (v) => {
        const digits = v.text.replace(/\s+/g, '');
        if (!/^[0-9]+$/.test(digits)) throw new Error('Excess-3 input must be decimal digits.');
        return textValue([...digits].map((d) => (Number(d) + 3).toString(2).padStart(4, '0')).join(' '), 'encoded');
      }
    },
    {
      id: 'decode', label: 'Decode', kind: 'decode',
      run: (v) => {
        const bits = v.text.replace(/[^01]/g, '');
        if (!bits || bits.length % 4) throw new Error('Excess-3 bits must come in 4-bit groups.');
        return textValue(
          Array.from({ length: bits.length / 4 }, (_, i) => {
            const n = parseInt(bits.slice(i * 4, i * 4 + 4), 2) - 3;
            if (n < 0 || n > 9) throw new Error(`Group ${bits.slice(i * 4, i * 4 + 4)} decodes outside 0–9.`);
            return String(n);
          }).join('')
        );
      }
    }
  ],
  examples: [{ label: 'Digits', input: '42' }]
});

/* ---------------------------- hamming (7,4) -------------------------------- */

const H74_ENC: number[] = [];
for (let d = 0; d < 16; d++) {
  const d1 = (d >> 3) & 1, d2 = (d >> 2) & 1, d3 = (d >> 1) & 1, d4 = d & 1;
  const p1 = d1 ^ d2 ^ d4, p2 = d1 ^ d3 ^ d4, p3 = d2 ^ d3 ^ d4;
  H74_ENC.push((p1 << 0) | (p2 << 1) | (d1 << 2) | (p3 << 3) | (d2 << 4) | (d3 << 5) | (d4 << 6));
}

defineOp({
  id: 'hamming-7-4',
  name: 'Hamming (7,4) Error Correction',
  category: 'codes',
  description: 'The classic single-error-correcting code: each 4-bit nibble becomes a 7-bit codeword with 3 parity bits. Decoding corrects one flipped bit — and tells you which.',
  aliases: ['hamming code', 'ecc', 'error correction', 'hamming 7 4'],
  tags: ['code', 'ecc', 'error-correction', 'binary'],
  input: 'any',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  options: [
    { type: 'toggle', key: 'hexInput', label: 'Input is hexadecimal bytes', default: false }
  ],
  actions: [
    {
      id: 'encode', label: 'Encode', kind: 'encode',
      run: (v, o) => {
        const bytes = o.hexInput ? hexToBytes(v.text) : utf8.encode(v.text);
        const codes: string[] = [];
        for (const b of bytes) {
          codes.push(H74_ENC[b >>> 4].toString(2).padStart(7, '0'));
          codes.push(H74_ENC[b & 15].toString(2).padStart(7, '0'));
        }
        return textValue(codes.join(' '), 'encoded');
      }
    },
    {
      id: 'decode', label: 'Decode & correct', kind: 'decode',
      run: (v) => {
        const bits = v.text.replace(/[^01]/g, '');
        if (!bits || bits.length % 7) throw new Error('Hamming(7,4) input must contain complete 7-bit codewords.');
        const nibbles: number[] = [];
        const log: string[] = [];
        let corrected = 0;
        for (let i = 0; i < bits.length; i += 7) {
          let code = parseInt(bits.slice(i, i + 7), 2);
          const p1 = 0, p2 = 1, p3 = 3; // parity positions
          const b = (pos: number) => (code >> pos) & 1;
          let s1 = b(p1) ^ b(2) ^ b(4) ^ b(6);
          let s2 = b(p2) ^ b(2) ^ b(5) ^ b(6);
          let s3 = b(p3) ^ b(4) ^ b(5) ^ b(6);
          const syndrome = s1 | (s2 << 1) | (s3 << 2);
          if (syndrome !== 0) {
            const errPos = syndrome - 1;
            code ^= 1 << errPos;
            corrected++;
            log.push(`codeword ${i / 7 + 1}: flipped bit position ${errPos + 1}`);
          }
          const d = (b(2) << 3) | (b(4) << 2) | (b(5) << 1) | b(6);
          nibbles.push(d);
        }
        const bytes = new Uint8Array(nibbles.length / 2);
        for (let i = 0; i < bytes.length; i++) bytes[i] = (nibbles[i * 2] << 4) | nibbles[i * 2 + 1];
        let body: string;
        try { body = utf8.decodeStrict(bytes); } catch { body = bytesToHex(bytes); }
        const summary = corrected === 0 ? 'no errors detected' : `${corrected} single-bit error${corrected === 1 ? '' : 's'} corrected (${log.join('; ')})`;
        return textValue(`${body}\n\n— ${summary}`);
      }
    }
  ],
  examples: [{ label: 'Hi', input: 'Hi' }],
  docs: 'Codeword layout (LSB-first): p1 p2 d1 p3 d2 d3 d4. The decoder computes the syndrome, corrects one error per codeword, and reports its repairs. Two-bit errors are outside (7,4)\'s guarantee.'
});

/* ------------------------ manchester / nrz line codes ---------------------- */

defineOp({
  id: 'manchester-encoding',
  name: 'Manchester Encoding',
  category: 'codes',
  description: 'IEEE 802.3 line code: every bit becomes a transition pair (0 → 01, 1 → 10), embedding the clock in the signal.',
  aliases: ['manchester code', 'phase encoding', '802.3'],
  tags: ['code', 'line code', 'signal', 'binary'],
  input: 'any',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  options: [
    { type: 'toggle', key: 'hexInput', label: 'Input is hexadecimal bytes', default: false },
    { type: 'select', key: 'style', label: 'Render', default: 'bits', options: [
      { value: 'bits', label: 'Transition pairs (01)' },
      { value: 'levels', label: 'Voltage levels (low-high)' }
    ] }
  ],
  actions: [
    {
      id: 'encode', label: 'Encode', kind: 'encode',
      run: (v, o) => {
        const bytes = o.hexInput ? hexToBytes(v.text) : utf8.encode(v.text);
        const bits = Array.from(bytes, (b) => b.toString(2).padStart(8, '0')).join('');
        if (String(o.style) === 'levels') {
          return textValue([...bits].map((b) => (b === '0' ? 'low-high' : 'high-low')).join(' '), 'encoded');
        }
        return textValue([...bits].map((b) => (b === '0' ? '01' : '10')).join(' '), 'encoded');
      }
    },
    {
      id: 'decode', label: 'Decode', kind: 'decode',
      run: (v, o) => {
        const clean = v.text.replace(/[^01]/g, '');
        if (!clean || clean.length % 2) throw new Error('Manchester input must be complete transition pairs (01/10).');
        let bits = '';
        for (let i = 0; i < clean.length; i += 2) {
          const pair = clean.slice(i, i + 2);
          if (pair === '01') bits += '0';
          else if (pair === '10') bits += '1';
          else throw new Error(`"${pair}" is a violation — Manchester pairs are always 01 or 10.`);
        }
        const bytes = new Uint8Array(bits.length / 8);
        for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
        try { return textValue(utf8.decodeStrict(bytes)); } catch { return textValue(bytesToHex(bytes), 'encoded'); }
      }
    }
  ],
  examples: [{ label: 'A', input: 'A', options: { style: 'levels' } }],
  docs: 'Decoding a clean Manchester stream always recovers the bits; decoding rejects level violations (00/11), which is exactly how receivers detect line faults.'
});

defineOp({
  id: 'nrz-encoding',
  name: 'NRZ Line Encoding',
  category: 'codes',
  description: 'Non-return-to-zero: a steady level per bit (1 = high, 0 = low). Simple but clock-free — long runs of one level drift receivers.',
  aliases: ['nrz', 'nrz-l', 'line coding'],
  tags: ['code', 'line code', 'signal', 'binary'],
  input: 'any',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  options: [{ type: 'toggle', key: 'hexInput', label: 'Input is hexadecimal bytes', default: false }],
  actions: [
    {
      id: 'encode', label: 'Encode', kind: 'encode',
      run: (v, o) => {
        const bytes = o.hexInput ? hexToBytes(v.text) : utf8.encode(v.text);
        const bits = Array.from(bytes, (b) => b.toString(2).padStart(8, '0')).join('');
        return textValue([...bits].map((b) => (b === '1' ? 'HIGH' : 'low')).join(' '), 'encoded');
      }
    },
    {
      id: 'decode', label: 'Decode', kind: 'decode',
      run: (v) => {
        const toks = v.text.trim().split(/\s+/);
        let bits = '';
        for (const t of toks) {
          if (/^(high|h|1)$/i.test(t)) bits += '1';
          else if (/^(low|l|0)$/i.test(t)) bits += '0';
          else throw new Error(`"${t}" is not a level token (expected HIGH/low).`);
        }
        if (bits.length % 8) throw new Error(`${bits.length} bits is not a whole number of bytes.`);
        const bytes = new Uint8Array(bits.length / 8);
        for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
        try { return textValue(utf8.decodeStrict(bytes)); } catch { return textValue(bytesToHex(bytes), 'encoded'); }
      }
    }
  ],
  examples: [{ label: 'Bit', input: 'Hi' }]
});

/* (hexToBytes import retained for ebcdic) */
