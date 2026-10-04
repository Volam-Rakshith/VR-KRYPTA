// AUTO-DETECT — the forensic identifier. One analyze(input) call runs every
// signature battery (charset, length, padding, entropy, statistics), proves
// candidates by actually decoding them, and ranks verified hits by confidence.
import { hasInk, inkDecode } from '../operations/invisibleInk';
import { EMOJI_THEMES, emojiDecode } from '../operations/emojiSkin';
import { MORSE } from '../operations/codes';
import { getOp } from '../operations/core/registry';
import '../operations';

export type HitFamily = 'encoding' | 'code' | 'cipher' | 'hash' | 'format' | 'secret' | 'unknown';

export interface DetectHit {
  id: string;
  label: string;
  family: HitFamily;
  /** 0..1 — calibrated: >0.85 signature-verified, 0.6–0.85 decode-verified, <0.6 statistical. */
  confidence: number;
  reason: string;
  /** Library op that can run this transform, when one exists. */
  opId?: string;
  /** Full decoded output (proved decodes only), capped at PREVIEW_LIMIT characters. */
  decoded?: string;
  /** True when the candidate can never decode (hashes). */
  oneWay?: boolean;
  /** True when decoding is impossible without a passphrase (VK1 blobs). */
  needsKey?: boolean;
  /** Advisory second line shown under the reason. */
  note?: string;
}

export interface SignalProfile {
  chars: number;
  bytes: number;
  distinct: number;
  entropy: number;
  printableRatio: number;
  letterRatio: number;
}

export function profile(input: string): SignalProfile {
  const s = input;
  const distinct = new Set(s).size;
  let printable = 0;
  let letters = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if ((c >= 0x20 && c <= 0x7e) || c === 0x0a || c === 0x0d || c === 0x09 || c >= 0xa0) printable++;
    if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) letters++;
  }
  return {
    chars: [...s].length,
    bytes: utf8.encode(s).length,
    distinct,
    entropy: shannon(s),
    printableRatio: s.length ? printable / s.length : 1,
    letterRatio: s.length ? letters / s.length : 0
  };
}

/* ------------------------------- statistics ------------------------------- */

const utf8 = new TextEncoder();
const utfDec = new TextDecoder('utf-8', { fatal: false });

export function shannon(s: string): number {
  if (!s) return 0;
  const counts = new Map<string, number>();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let h = 0;
  for (const n of counts.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

const ENG_BIGRAMS = 'th,he,in,er,an,re,on,at,en,nd,ed,it,ou,ea,hi,st,ng,ar,te,se'.split(',');
const ENG_WORDS = ['the', 'of', 'and', 'to', 'in', 'a', 'is', 'that', 'for', 'you', 'it', 'be', 'are', 'we', 'on', 'with', 'have', 'not', 'this'];

/** 0..1 — how much this string smells like natural English. */
export function englishScore(s: string): number {
  const t = s.toLowerCase().slice(0, 400);
  if (t.length < 2) return 0;
  const letters = (t.match(/[a-z]/g) ?? []).length;
  const letterRatio = letters / t.length;
  const spaces = (t.match(/ /g) ?? []).length;
  const spaceRatio = spaces / t.length;
  const vowels = (t.match(/[aeiou]/g) ?? []).length;
  const vowelRatio = letters ? vowels / letters : 0;
  const bigramHits = ENG_BIGRAMS.reduce((n, b) => n + (t.includes(b) ? 1 : 0), 0);
  const wordHits = ENG_WORDS.reduce((n, w) => n + (t.split(' ').includes(w) ? 1 : 0), 0);

  let score = 0;
  score += 0.22 * clamp01((letterRatio - 0.5) / 0.35);          // letters dominate
  score += 0.16 * clamp01(1 - Math.abs(spaceRatio - 0.17) / 0.17); // sane spacing
  score += 0.24 * clamp01(1 - Math.abs(vowelRatio - 0.38) / 0.24); // vowel climate
  score += 0.20 * Math.min(1, bigramHits / 9);                     // English bigrams
  score += 0.18 * Math.min(1, wordHits / 4);                       // common words
  if (t.length < 6) score *= 0.7;
  return clamp01(score);
}

function clamp01(x: number): number { return Math.max(0, Math.min(1, x)); }

/** Index of coincidence over A–Z letters. */
export function indexOfCoincidence(s: string): number {
  const counts = new Array(26).fill(0);
  let n = 0;
  for (const ch of s.toUpperCase()) {
    const c = ch.charCodeAt(0);
    if (c >= 65 && c <= 90) { counts[c - 65]++; n++; }
  }
  if (n < 2) return 0;
  let sum = 0;
  for (const c of counts) sum += c * (c - 1);
  return sum / (n * (n - 1));
}

/* ------------------------------ byte decoders ----------------------------- */

function hexToBytes(clean: string): Uint8Array | null {
  const s = clean.replace(/\s+/g, '');
  if (s.length < 8 || s.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(s)) return null;
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function bitStringToBytes(clean: string, width: number): Uint8Array | null {
  const bits = clean.replace(/\s+/g, '');
  if (bits.length < width * 2 || bits.length % width !== 0 || !/^[01]+$/.test(bits)) return null;
  const out = new Uint8Array(bits.length / width);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(bits.slice(i * width, (i + 1) * width), 2);
  return out;
}

function b64ToBytes(clean: string, urlSafe: boolean): Uint8Array | null {
  let s = clean.replace(/\s+/g, '');
  if (s.length < 8) return null;
  const alpha = urlSafe ? /^[A-Za-z0-9_-]+=*$/ : /^[A-Za-z0-9+/]+=*$/;
  const st = urlSafe ? /^[A-Za-z0-9_-]*$/ : /^[A-Za-z0-9+/]*$/;
  const m = s.match(/(=*)$/);
  const padding = m ? m[0].length : 0;
  if (!alpha.test(s)) return null;
  const body = s.replace(/=+$/, '');
  if (padding > 2) return null;
  const rem = body.length % 4;
  if (!urlSafe && (body.length + padding) % 4 !== 0) return null;
  if (urlSafe && rem === 1) return null;
  if (!st.test(body)) return null;
  try {
    const norm = (urlSafe ? body.replace(/-/g, '+').replace(/_/g, '/') : body) + (urlSafe && rem ? '='.repeat(4 - rem) : '');
    const bin = atob(norm);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

function base32ToBytes(clean: string): Uint8Array | null {
  let s = clean.replace(/\s+/g, '');
  if (s.length < 16 || s.length % 8 !== 0) return null;
  const m = s.match(/(=*)$/);
  const pad = m ? m[0].length : 0;
  if (![0, 1, 3, 4, 6].includes(pad)) return null;
  let body = s.replace(/=+$/, '');
  if (/^[a-z2-7]+$/.test(body.replace(/[a-z]/g, ''))) { /* digits only ok */ }
  const lowerFix = /[a-z]/.test(body) && !/[A-Z]/.test(body);
  if (lowerFix) body = body.toUpperCase();
  if (!/^[A-Z2-7]+$/.test(body)) return null;
  const alph = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of body) {
    value = (value << 5) | alph.indexOf(ch);
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return new Uint8Array(out);
}

function base58ToBytes(clean: string): Uint8Array | null {
  let s = clean.trim();
  if (s.length < 12 || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(s)) return null;
  const alph = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const digits: number[] = [];
  for (const ch of s) {
    let carry = alph.indexOf(ch);
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] * 58;
      digits[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) { digits.push(carry & 0xff); carry >>= 8; }
  }
  for (const ch of s) { if (ch === '1') digits.push(0); else break; }
  return new Uint8Array(digits.reverse());
}

function ascii85ToBytes(clean: string): Uint8Array | null {
  let s = clean.replace(/\s+/g, '');
  if (s.startsWith('<~')) s = s.slice(2);
  if (s.endsWith('~>')) s = s.slice(0, -2);
  if (s.length < 10 || s.length % 5 !== 0 || ![...s].every((c) => c === 'z' || (c >= '!' && c <= 'u'))) return null;
  const out: number[] = [];
  for (let i = 0; i < s.length; i += 5) {
    const chunk = s.slice(i, i + 5);
    let value = 0;
    if (chunk === 'zzzzz') { out.push(0, 0, 0, 0); continue; }
    for (const c of chunk) value = value * 85 + (c.charCodeAt(0) - 33);
    out.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
  }
  return new Uint8Array(out);
}

function bytesText(bytes: Uint8Array): string {
  return utfDec.decode(bytes);
}

function printableRatioOf(s: string): number {
  if (!s) return 0;
  let good = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    if ((c >= 0x20 && c <= 0x7e) || c === 0x0a || c === 0x0d || c === 0x09 || c >= 0xa0) good++;
  }
  return good / s.length;
}

/* ----------------------------- code dictionaries --------------------------- */

const MORSE_REV: Record<string, string> = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

const BACON_INDEX = (i: number) => String.fromCharCode(97 + i);

const BRAILLE_ABC = '⠁⠃⠉⠙⠑⠋⠛⠓⠊⠚⠅⠇⠍⠝⠕⠏⠟⠗⠎⠞⠥⠧⠺⠭⠽⠵';
const BRAILLE_REV: Record<string, string> = Object.fromEntries([...BRAILLE_ABC].map((g, i) => [g, BACON_INDEX(i)]));

// Rotary semaphore table (1-8 clock positions, J omitted per convention).
const SEMAPHORE_MAP: Record<string, string> = (() => {
  const assign: [string, [number, number]][] = [
    ['A', [1, 2]], ['B', [1, 3]], ['C', [1, 4]], ['D', [1, 5]], ['E', [1, 6]], ['F', [1, 7]], ['G', [1, 8]],
    ['H', [2, 3]], ['I', [2, 4]], ['K', [2, 5]], ['L', [2, 6]], ['M', [2, 7]], ['N', [2, 8]],
    ['O', [3, 4]], ['P', [3, 5]], ['Q', [3, 6]], ['R', [3, 7]], ['S', [3, 8]],
    ['T', [4, 5]], ['U', [4, 6]], ['Y', [4, 7]], ['J', [5, 7]], ['V', [5, 8]], ['W', [6, 7]], ['X', [6, 8]], ['Z', [7, 8]]
  ];
  const map: Record<string, string> = {};
  for (const [l, p] of assign) map[p.join('-')] = l;
  return map;
})();


const NATO_WORDS = 'alfa,bravo,charlie,delta,echo,foxtrot,golf,hotel,india,juliett,kilo,lima,mike,november,oscar,papa,quebec,romeo,sierra,tango,uniform,victor,whiskey,x-ray,xray,yankee,zulu,zero,one,two,three,four,five,six,seven,eight,nine'.split(',');
const NATO_DIGITS: Record<string, string> = { zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9' };
const FLAG_NAMES = 'alfa,bravo,charlie,delta,echo,foxtrot,golf,hotel,india,juliet(kilo),kilo,lima,mike,november,oscar,papa,quebec,romeo,sierra,tango,uniform,victor,whiskey,xray,yankee,zulu';

const TAP_WIZ = 'ABCDEFGHIKLMNOPQRSTUVWXYZ';

/* ---------------------------- attack primitives --------------------------- */

function caesarShift(s: string, n: number): string {
  return s.replace(/[a-z]/gi, (ch) => {
    const base = ch >= 'a' ? 97 : 65;
    return String.fromCharCode(((ch.charCodeAt(0) - base + n) % 26 + 26) % 26 + base);
  });
}

function atbashDecode(s: string): string {
  return s.replace(/[a-z]/gi, (ch) => {
    const base = ch >= 'a' ? 97 : 65;
    return String.fromCharCode(base + 25 - (ch.charCodeAt(0) - base));
  });
}

function bestCaesarShift(bytes: string): { shift: number; text: string; score: number; margin: number } {
  let best = { shift: 0, text: bytes, score: 0 }, second = 0;
  for (let n = 0; n < 26; n++) {
    const t = caesarShift(bytes, n);
    const sc = englishScore(t);
    if (sc > best.score) { second = best.score; best = { shift: n, text: t, score: sc }; }
    else if (sc > second) second = sc;
  }
  return { ...best, margin: best.score - second };
}

function bestSingleByteXOR(bytes: Uint8Array): { key: number; text: string; score: number } | null {
  let best: { key: number; text: string; score: number } | null = null;
  for (let k = 1; k < 256; k++) {
    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ k;
    const t = bytesText(out);
    const sc = englishScore(t) * (printableRatioOf(t) ** 2);
    if (!best || sc > best.score) best = { key: k, text: t, score: sc };
  }
  return best;
}

/* ------------------------------- op bridge -------------------------------- */

async function decodeViaOp(opId: string, input: string): Promise<string | null> {
  const op = getOp(opId);
  if (!op) return null;
  const action = op.actions.find((a) => a.kind === 'decode' || a.kind === 'analyze') ?? op.actions[op.actions.length - 1];
  if (!action || op.engine === 'python') return null;
  try {
    const opts: Record<string, unknown> = {};
    for (const f of op.options ?? []) opts[f.key] = f.type === 'number' ? (f.default ?? 0) : (f as { default?: unknown }).default;
    const out = await action.run({ kind: 'text', text: input }, opts, { python: async () => null });
    return out.text;
  } catch {
    return null;
  }
}

const PREVIEW_LIMIT = 6000;

function capText(t: string | null): string | undefined {
  if (t === null) return undefined;
  return t.length > PREVIEW_LIMIT ? t.slice(0, PREVIEW_LIMIT) + '\n…(truncated)' : t;
}

/* --------------------------------- engine --------------------------------- */

export async function analyze(rawInput: string): Promise<DetectHit[]> {
  const input = rawInput.slice(0, 20000);
  const hits: DetectHit[] = [];
  const prof = profile(input);
  const trimmed = input.trim();
  const noSpace = trimmed.replace(/\s+/g, '');
  const add = (h: DetectHit) => hits.push(h);

  // --- signature-only fast paths (never need statistics) ---
  if (/^VK1\./.test(trimmed)) {
    const tl = /^VK1\.T\./.test(trimmed);
    add({
      id: 'vk1' + (tl ? '-tl' : ''),
      label: tl ? 'KRYPTA Timelocked Locker blob (VK1.T)' : 'KRYPTA Secret Locker blob (VK1)',
      family: 'secret',
      confidence: 1,
      reason: tl
        ? 'Exact VK1.T signature — passphrase + hash-chain grind both required. Ask the sender for the password.'
        : 'Exact VK1 signature — AES-256-GCM under a passphrase. Ask the sender for the password. Any text appended after does not matter; authors often hide it behind cover text.',
      opId: 'message-locker',
      needsKey: true,
      note: 'Open this in the LOCKER or SECRET-DROP reveal flow with the passphrase.'
    });
  }
  if (hasInk(input)) {
    const secret = inkDecode(input);
    add({
      id: 'invisible-ink',
      label: 'Invisible Ink (zero-width steganography)',
      family: 'secret',
      confidence: 1,
      reason: 'Zero-width bit patterns detected between the visible characters.',
      opId: 'invisible-ink',
      decoded: capText(secret),
      note: 'This is hiding, not encryption — anyone can read it once they know where to look.'
    });
  }
  for (const themeId of Object.keys(EMOJI_THEMES)) {
    try {
      const decoded = emojiDecode(input, themeId);
      if (decoded !== null && decoded.length >= 2 && printableRatioOf(decoded) > 0.85) {
        const eng = englishScore(decoded);
        if (eng > 0.45 || /^VK1\./.test(decoded) || decoded.startsWith('http')) {
          add({
            id: 'emoji-skin',
            label: `Emoji Cipherskin (${EMOJI_THEMES[themeId].name} theme)`,
            family: 'code',
            confidence: Math.min(0.94, 0.62 + eng * 0.35),
            reason: 'Clean two-emoji-per-byte mapping in this theme; decode is byte-perfect reversible.',
            opId: 'emoji-skin',
            decoded: capText(decoded),
            note: 'Pure encoding, zero secrecy — treat as a costume.'
          });
          break;
        }
      }
    } catch { /* not this theme */ }
  }
  if (/^data:[\w/+.-]*(?:;[a-z0-9=.+-]+)?(?:;base64)?,/i.test(trimmed)) {
    const comma = trimmed.indexOf(',');
    const head = trimmed.slice(0, comma);
    const body = trimmed.slice(comma + 1).replace(/\s+/g, '');
    let decoded: string | undefined;
    let family: HitFamily = 'format';
    const isB64 = /;base64/i.test(head);
    try {
      decoded = isB64 ? String.fromCharCode(...b64ToBytes(body, false) ?? []) : decodeURIComponent(body);
    } catch { decoded = undefined; }
    add({
      id: 'data-uri',
      label: `Data URI (${(head.match(/data:([\w/+.-]+)/) ?? [])[1] ?? 'unknown type'})`,
      family,
      confidence: 0.97,
      reason: 'RFC 2397 data: prefix — inline embedded resource.',
      opId: 'data-uri',
      decoded: capText(decoded ?? body),
      note: isB64 ? 'Payload was Base64 — decoded for you.' : undefined
    });
  }
  {
    const m = trimmed.match(/^([A-Za-z0-9_-]{4,})\.([A-Za-z0-9_-]{4,})\.([A-Za-z0-9_-]*)$/);
    if (m) {
      const h = b64ToBytes(m[1], true);
      const headText = h ? bytesText(h) : '';
      if (h && /^[{[]/.test(headText)) {
        let pretty = headText;
        try { pretty = JSON.stringify(JSON.parse(headText), null, 2); } catch { /* raw */ }
        const p = b64ToBytes(m[2], true);
        let payload = p ? bytesText(p) : '';
        try { payload = JSON.stringify(JSON.parse(payload), null, 2); } catch { /* raw */ }
        add({
          id: 'jwt',
          label: 'JSON Web Token (JWT)',
          family: 'format',
          confidence: 0.93,
          reason: 'Three Base64URL segments; header decodes to JSON.',
          decoded: capText(`HEADER:\n${pretty}\n\nPAYLOAD:\n${payload}`),
          opId: 'base64url',
          oneWay: false,
          note: m[3] ? 'Signed — the signature is not verified here. Never trust a decoded JWT without verification.' : 'Unsigned token — three dots but empty signature segment.'
        });
      }
    }
  }

  // --- positional / glyph signatures ---
  if (/^(?:[⠀-⣿] *)+$/u.test(trimmed) && [...trimmed].some((c) => (c.codePointAt(0) ?? 0) >= 0x2801)) {
    let decoded = '';
    for (const ch of trimmed) decoded += ch === ' ' ? ' ' : (BRAILLE_REV[ch] ?? '□');
    const eng = englishScore(decoded);
    add({
      id: 'braille',
      label: 'Braille Patterns (Grade 1)',
      family: 'code',
      confidence: Math.min(0.95, 0.72 + eng * 0.23),
      reason: 'Every character lives in the Unified Braille block U+2800–U+28FF.',
      opId: 'braille',
      decoded: capText(decoded.replace(/□+$/, "")),
    });
  }
  {
    const pigpenGlyphs = '┘┐└┌├┤┬┴┼─│╺╹□◇·∟∠';
    const only = [...trimmed].filter((c) => c !== ' ' && c !== '\n');
    if (only.length >= 4 && only.every((c) => pigpenGlyphs.includes(c))) {
      const decoded = await decodeViaOp('pigpen', trimmed);
      add({
        id: 'pigpen',
        label: "Pigpen (tic-tac-toe grid cipher)",
        family: 'code',
        confidence: decoded && englishScore(decoded) > 0.4 ? 0.93 : 0.78,
        reason: 'Character alphabet is entirely Pigpen box-drawing glyphs — there is no other system using this set.',
        opId: 'pigpen',
        decoded: capText(decoded),
        note: 'Pure substitution — secrecy dies the moment someone recognises the shapes.'
      });
    }
  }
  if (/⟦[A-Z?]⟧/u.test(trimmed)) {
    const decoded = await decodeViaOp('dancing-men', trimmed);
    add({
      id: 'dancing-men',
      label: "Dancing Men (Doyle canon)",
      family: 'code',
      confidence: 0.96,
      reason: '⟦X⟧ bracket tokens are the toolkit’s accessible Dancing-Men form.',
      opId: 'dancing-men',
      decoded: capText(decoded),
      note: 'Only the canon-attested letters decode.'
    });
  }
  {
    const toks = trimmed.split(/\s+/);
    if (toks.length >= 3 && toks.every((t) => /^[1-8]-[1-8]$/.test(t))) {
      const parts = toks.map((t) => t);
      if (parts.filter((t) => SEMAPHORE_MAP[t]).length >= Math.max(2, Math.floor(parts.length * 0.7))) {
        const decoded = parts.map((t) => SEMAPHORE_MAP[t] ?? '?').join('');
        const eng = englishScore(decoded.toLowerCase());
        add({
          id: 'semaphore',
          label: 'Flag Semaphore (clock-face pairs)',
          family: 'code',
          confidence: Math.min(0.92, 0.6 + eng * 0.35),
          reason: 'Repeated i-j coordinate pairs over positions 1–8.',
          opId: 'semaphore',
          decoded: capText(decoded)
        });
      }
    }
  }

  // --- morse & telegraph codes ---
  if (/^[.\-|/ \s]+$/.test(trimmed) && /[.\-]{1,}/.test(trimmed)) {
    const wordToks = trimmed.split(/\s*\/\s*|\s{3,}|\|/);
    let valid = true;
    const words: string[] = [];
    for (const w of wordToks) {
      const letterToks = w.trim().split(/\s+/).filter(Boolean);
      const letters: string[] = [];
      for (const k of letterToks) {
        const ch = MORSE_REV[k];
        if (!ch) { valid = false; break; }
        letters.push(ch);
      }
      if (!valid) break;
      if (letters.length > 0) words.push(letters.join(''));
    }
    if (valid && wordToks.join('').length > 0) {
      const decoded = words.join(' ');
      const eng = englishScore(decoded.toLowerCase());
      const tokenCount = trimmed.split(/\s+/).filter(Boolean).length;
      if (tokenCount >= 2) {
        add({
          id: 'morse',
          label: 'Morse Code (International)',
          family: 'code',
          confidence: Math.min(0.96, 0.6 + eng * 0.36),
          reason: 'Every dot-dash token maps to a valid International Morse symbol.',
          opId: 'morse',
          decoded: capText(decoded)
        });
      }
    }
  }

  // --- byte-shape encodings ---
  const hexBytes = hexToBytes(trimmed);
  if (hexBytes) {
    const text = bytesText(hexBytes);
    const pr = printableRatioOf(text);
    const eng = englishScore(text);
    const magic = hexBytes.length >= 2
      ? (hexBytes[0] === 0x1f && hexBytes[1] === 0x8b)
        ? 'gzip-stream'
        : (hexBytes[0] === 0x50 && hexBytes[1] === 0x4b)
          ? 'zip'
          : (hexBytes[0] === 0x89 && hexBytes[1] === 0x50)
            ? 'png'
            : (hexBytes[0] === 0x78 && (hexBytes[1] === 0x9c || hexBytes[1] === 0xda || hexBytes[1] === 0x01))
              ? 'zlib'
              : null
      : null;
    if (magic) {
      add({
        id: 'magic-' + magic,
        label: magic === 'gzip-stream' ? 'gzip compressed stream — magic 1F 8B'
          : magic === 'zip' ? 'ZIP archive signature — PK'
            : magic === 'png' ? 'PNG image signature'
              : 'zlib stream — magic 78',
        family: 'format',
        confidence: 0.92,
        reason: `Leading byte signature matches ${magic} — this hex is raw compressed/binary data.`,
        opId: magic === 'gzip-stream' ? 'gzip' : magic === 'zlib' ? 'zlib' : 'magic-number-detector',
        note: 'Paste as a file (workspace Load file) or hex → bytes to unpack.'
      });
    }
    if (pr > 0.92 && eng > 0.35) {
      add({
        id: 'hex-text',
        label: 'Hexadecimal Representation',
        family: 'encoding',
        confidence: Math.min(0.94, 0.4 + eng * 0.55),
        reason: 'Even-length 0–9A–F stream; decoded bytes are printable text.',
        opId: 'hex-text',
        decoded: capText(text)
      });
    } else if ([32, 40, 56, 64, 96, 128].includes(noSpace.length) && /^[0-9a-fA-F]+$/.test(noSpace)) {
      const map: Record<number, string> = {
        32: 'MD5 / NTLM-style 128-bit digest',
        40: 'SHA-1 or RIPEMD-160 (40 hex chars)',
        56: 'SHA-224 / SHA-512/224 (56 hex chars)',
        64: 'SHA-256 / BLAKE2s / SHA-512/256 / SHA3-256 (64 hex chars)',
        96: 'SHA-384 (96 hex chars)',
        128: 'SHA-512 / BLAKE2b / SHA3-512 (128 hex chars)'
      };
      add({
        id: 'hashlen-' + noSpace.length,
        label: map[noSpace.length] ?? 'Hex digest',
        family: 'hash',
        confidence: noSpace.length >= 64 ? 0.86 : 0.8,
        reason: `Exactly ${noSpace.length / 2} bytes of pure hex — a digest's favourite disguise.`,
        oneWay: true,
        note: 'A hash cannot be decoded — only recomputed and compared. Try it against known strings in the hashing section.'
      });
    } else {
      const xor = bestSingleByteXOR(hexBytes);
      if (xor && xor.score > 0.5) {
        add({
          id: 'single-xor',
          label: `Single-byte XOR cipher (key 0x${xor.key.toString(16).padStart(2, '0').toUpperCase()})`,
          family: 'cipher',
          confidence: Math.min(0.9, 0.5 + xor.score * 0.4),
          reason: 'Hex decodes to non-text bytes; one XOR key restores fluent English.',
          opId: 'single-byte-xor-cracker',
          decoded: capText(xor.text),
          note: `Decrypt with key 0x${xor.key.toString(16).padStart(2, '0').toUpperCase()} — try XOR or the cracker op.`
        });
      }
    }
  }

  const widths = [8, 7] as const;
  for (const w of widths) {
    const binBytes = bitStringToBytes(trimmed, w);
    if (binBytes) {
      const text = bytesText(binBytes);
      const eng = englishScore(text);
      if (printableRatioOf(text) > 0.9) {
        add({
          id: 'binary-' + w,
          label: w === 8 ? 'Binary Representation (8-bit)' : 'Binary Representation (7-bit)',
          family: 'encoding',
          confidence: Math.min(0.94, 0.5 + eng * 0.44),
          reason: `Pure 0/1 stream divisible into ${w}-bit groups that spell text.`,
          opId: 'binary-text',
          decoded: capText(text)
        });
      }
      break;
    }
  }
  {
    const groups = trimmed.split(/\s+/).filter(Boolean);
    const octalOk = groups.length >= 3 && groups.every((g) => /^[0-7]{1,3}$/.test(g) && parseInt(g, 8) <= 511);
    if (octalOk && groups.some((g) => g.length === 3)) {
      const bytes = new Uint8Array(groups.map((g) => parseInt(g, 8) & 0xff));
      const text = bytesText(bytes);
      const eng = englishScore(text);
      if (printableRatioOf(text) > 0.9) {
        add({
          id: 'octal',
          label: 'Octal Representation',
          family: 'encoding',
          confidence: Math.min(0.9, 0.45 + eng * 0.45),
          reason: 'Space-separated groups decode as base-8 bytes into printable text.',
          opId: 'octal-text',
          decoded: capText(text)
        });
      }
    }
    const decOk = groups.length >= 3 && groups.every((g) => /^\d{1,3}$/.test(g) && Number(g) <= 255);
    if (decOk) {
      const numbers = groups.map(Number);
      const bytes = new Uint8Array(numbers);
      const text = bytesText(bytes);
      const eng = englishScore(text);
      if (printableRatioOf(text) > 0.88) {
        add({
          id: 'decimal',
          label: 'Decimal Byte Values',
          family: 'encoding',
          confidence: Math.min(0.85, 0.35 + eng * 0.5),
          reason: 'Space-separated 0–255 values spell printable text as bytes.',
          opId: 'decimal-text',
          decoded: capText(text)
        });
      }
      if (numbers.every((n) => n >= 1 && n <= 26)) {
        const letters = numbers.map((n) => String.fromCharCode(96 + n)).join('');
        const eng2 = englishScore(letters);
        add({
          id: 'a1z26',
          label: 'A1Z26 Letter Numbers',
          family: 'code',
          confidence: Math.min(0.9, 0.5 + eng2 * 0.4),
          reason: 'Every value sits in 1–26 and the letter mapping reads as language.',
          opId: 'a1z26',
          decoded: capText(letters)
        });
      }
      const tapGroups = groups.filter((g) => /^[1-5][1-5]$/.test(g));
      if (tapGroups.length >= 3 && tapGroups.length === groups.length) {
        const letters = tapGroups.map((g) => {
          const r = Number(g[0]) - 1, c = Number(g[1]) - 1;
          return TAP_WIZ[r * 5 + c] ?? '?';
        }).join('').toLowerCase();
        const eng3 = englishScore(letters);
        add({
          id: 'tap-code',
          label: 'Tap Code (Polybius knock)',
          family: 'code',
          confidence: Math.min(0.88, 0.42 + eng3 * 0.46),
          reason: 'All groups are 1–5 row/column pairs of a 5×5 square.',
          opId: 'tap-code',
          decoded: capText(letters)
        });
      }
    }
  }
  {
    const b = b64ToBytes(trimmed, false);
    if (b) {
      const text = bytesText(b);
      const eng = englishScore(text);
      if (printableRatioOf(text) > 0.92) {
        add({
          id: 'base64',
          label: 'Base64 (RFC 4648)',
          family: 'encoding',
          confidence: Math.min(0.95, 0.42 + eng * 0.53 + (/=$/.test(trimmed) ? 0.05 : 0)),
          reason: 'Canonical 64-symbol alphabet, length multiple of 4 — and it decodes to text.',
          opId: 'base64',
          decoded: capText(text)
        });
      }
    }
    const bu = b64ToBytes(trimmed, true);
    if (bu) {
      const text = bytesText(bu);
      const eng = englishScore(text);
      if (printableRatioOf(text) > 0.92) {
        add({
          id: 'base64url',
          label: 'Base64URL',
          family: 'encoding',
          confidence: Math.min(0.9, 0.38 + eng * 0.5),
          reason: 'URL-safe -_ alphabet decodes to readable text.',
          opId: 'base64url',
          decoded: capText(text)
        });
      }
    }
    const b32 = base32ToBytes(trimmed);
    if (b32) {
      const text = bytesText(b32);
      const eng = englishScore(text);
      if (printableRatioOf(text) > 0.88) {
        add({
          id: 'base32',
          label: 'Base32 (RFC 4648)',
          family: 'encoding',
          confidence: Math.min(0.92, 0.44 + eng * 0.46),
          reason: 'A–Z2–7 alphabet with valid padding, decodes to text.',
          opId: 'base32',
            decoded: capText(text)
          });
      }
    }
    const b58 = base58ToBytes(trimmed);
    if (b58) {
      const text = bytesText(b58);
      const eng = englishScore(text);
      if (printableRatioOf(text) > 0.92) {
        add({
          id: 'base58',
          label: 'Base58 (Bitcoin alphabet)',
          family: 'encoding',
          confidence: Math.min(0.88, 0.4 + eng * 0.45),
          reason: 'No 0/O/I/l anywhere — decoded to text.',
          opId: 'base58',
          decoded: capText(text)
        });
      }
    }
    const a85 = ascii85ToBytes(trimmed);
    if (a85) {
      const text = bytesText(a85);
      const eng = englishScore(text);
      if (printableRatioOf(text) > 0.9) {
        add({
          id: 'ascii85',
          label: 'Ascii85 / Base85',
          family: 'encoding',
          confidence: Math.min(0.88, 0.4 + eng * 0.46),
          reason: '33–117 printable ASCII range in 5-char rows, decodes to text.',
          opId: 'base85',
          decoded: capText(text)
        });
      }
    }
  }

  // --- web escapes ---
  {
    const pctHit = (trimmed.match(/%[0-9a-fA-F]{2}/g) ?? []).length;
    if (pctHit >= 3 || (pctHit >= 1 && /%[0-9a-fA-F]{2}/.test(trimmed) && pctHit / trimmed.length > 0.16)) {
      try {
        const text = decodeURIComponent(trimmed.replace(/\+/g, '%20'));
        if (text !== trimmed) {
          const eng = englishScore(text);
          add({
            id: 'percent',
            label: 'Percent / URL Encoding',
            family: 'encoding',
            confidence: Math.min(0.95, 0.6 + eng * 0.33),
            reason: `${pctHit} %XX escapes in a small span — that's never accidental.`,
            opId: 'percent-encoding',
            decoded: capText(text)
          });
        }
      } catch { /* malformed escapes */ }
    }
    const entHit = (trimmed.match(/&(?:#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g) ?? []).length;
    if (entHit >= 2) {
      const text = trimmed
        .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'");
      add({
        id: 'html-entities',
        label: 'HTML Entities',
        family: 'encoding',
        confidence: Math.min(0.93, 0.58 + entHit / 12),
        reason: `${entHit} entity references (&name; &#123; &#x1F600;) — classic HTML escaping.`,
        opId: 'html-entities',
        decoded: capText(text)
      });
    }
    if ((trimmed.match(/=[0-9a-fA-F]{2}/) ?? null) && /=[0-9a-fA-F]{2}/.test(trimmed)) {
      const eqs = (trimmed.replace(/=[0-9a-fA-F]{2}/g, '').match(/=/g) ?? []).length;
      const bytes = [...trimmed.replace(/=\r?\n/g, '')];
      let out = '';
      for (let i = 0; i < bytes.length; i++) {
        if (bytes[i] === '=' && /^[0-9a-fA-F]{2}$/.test(bytes[i + 1] + bytes[i + 2])) {
          out += String.fromCharCode(parseInt(bytes[i + 1] + bytes[i + 2], 16));
          i += 2;
        } else out += bytes[i];
      }
      if (out.trim().length > 2 && printableRatioOf(out) > 0.9) {
        add({
          id: 'quoted-printable',
          label: 'Quoted-Printable (MIME)',
          family: 'encoding',
          confidence: Math.min(0.85, 0.55 + eqs * 0.02),
          reason: '=XX byte escapes with soft line breaks — the email transfer format.',
          opId: 'quoted-printable',
          decoded: capText(out)
        });
      }
    }
    const uuHit = trimmed.match(/^begin \d+ .+$/m);
    if (uuHit) {
      add({
        id: 'uuencode',
        label: 'UUencode',
        family: 'encoding',
        confidence: 0.95,
        reason: '"begin <mode> <name>" header — the classic Unix mail binary-to-text.',
        opId: 'uuencode',
        note: 'Open in the studio to decode fully.'
      });
    }
    const upTokens = trimmed.match(/\bU\+[0-9A-Fa-f]{4,6}\b/g);
    const jsTokens = trimmed.match(/\\u[0-9a-fA-F]{4}/g);
    if (upTokens && upTokens.length >= 3) {
      const decoded = trimmed.replace(/\bU\+([0-9A-Fa-f]{4,6})\b/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
      add({
        id: 'unicode-codepoints',
        label: 'Unicode Code Points (U+XXXX)',
        family: 'encoding',
        confidence: 0.92,
        reason: 'U+XXXX notation — the registry spelling of characters.',
        opId: 'unicode-codepoints',
        decoded: capText(decoded)
      });
    } else if (jsTokens && jsTokens.length >= 2) {
      const decoded = trimmed.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
      add({
        id: 'js-escapes',
        label: 'JavaScript Unicode escapes (\\uXXXX)',
        family: 'encoding',
        confidence: 0.86,
        reason: 'Backslash-u escapes — JS literal spelling.',
        opId: 'js-string-escaping',
        decoded: capText(decoded)
      });
    }
  }

  // --- word-code dictionaries ---
  {
    const words = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length >= 3) {
      const natoHits = words.filter((w) => NATO_WORDS.includes(w)).length;
      const flagHits = words.filter((w) => FLAG_NAMES.split(',').includes(w)).length;
      if (natoHits / words.length >= 0.85) {
        const decoded = words.map((w) => {
          if (w === 'x-ray' || w === 'xray') return 'X';
          if (NATO_DIGITS[w]) return NATO_DIGITS[w];
          const idx = NATO_WORDS.indexOf(w);
          return idx >= 0 && idx < 26 ? String.fromCharCode(65 + idx) : '?';
        }).join('');
        add({
          id: 'nato',
          label: 'NATO Phonetic Alphabet',
          family: 'code',
          confidence: 0.94,
          reason: 'Nearly every word is an ICAO phonetic spelling.',
          opId: 'nato-phonetic',
          decoded: capText(decoded)
        });
      } else if (flagHits / words.length >= 0.8 && words.length >= 4) {
        add({
          id: 'signal-flags',
          label: 'International Maritime Signal Flags',
          family: 'code',
          confidence: 0.82,
          reason: 'Flag-name vocabulary — could be the ICS single-letter registry.',
          opId: 'maritime-flags',
          note: 'Open in the studio to disambiguate from NATO spelling.'
        });
      }
    }
  }

  // --- classical-cipher reads ---
  const lettersOnly = trimmed.replace(/[^a-zA-Z]/g, '');
  if (lettersOnly.length >= 12 && prof.printableRatio > 0.9) {
    const ic = indexOfCoincidence(lettersOnly);
    const best = bestCaesarShift(trimmed);
    if (best.score > 0.55 && best.margin > 0.07 && lettersOnly.length >= 16) {
      add({
        id: 'caesar',
        label: best.shift === 13 ? 'ROT13 (Caesar +13)' : best.shift === 0 ? 'Plain text (high English score)' : `Caesar cipher, shift +${26 - best.shift}`,
        family: 'cipher',
        confidence: Math.min(0.94, 0.55 + best.score * 0.4),
        reason: best.shift === 0
          ? 'Reads as English with no transformation — maybe it’s just text.'
          : `Of all 26 shifts, only +${26 - best.shift} reads as English (score gap ${best.margin.toFixed(2)}).`,
        opId: 'caesar-brute-force',
        decoded: capText(best.text)
      });
    } else if (ic > 0.058 && lettersOnly.length >= 30) {
      const atb = atbashDecode(trimmed);
      const atbScore = englishScore(atb);
      if (atbScore > 0.6) {
        add({
          id: 'atbash',
          label: 'Atbash Cipher (A↔Z)',
          family: 'cipher',
          confidence: Math.min(0.9, 0.55 + atbScore * 0.35),
          reason: 'Letter distribution is English-shaped but mirrored — Atbash restores it.',
          opId: 'atbash',
          decoded: capText(atb)
        });
      } else {
        add({
          id: 'monoalphabetic',
          label: 'Monoalphabetic substitution (unknown key)',
          family: 'cipher',
          confidence: 0.52,
          reason: `Index of coincidence ${ic.toFixed(3)} ≈ English — the distribution survived, so no polyalphabetic blurring happened. No Caesar/Atbash fits.`,
          opId: 'frequency-analysis',
          note: 'Next moves: frequency analysis, then try Simple Substitution, Affine, or a keyword Vigenère breaker.'
        });
      }
    } else if (ic >= 0.038 && ic < 0.056 && lettersOnly.length >= 40) {
      add({
        id: 'vigenere-hint',
        label: 'Vigenère-like (low IC, polyalphabetic)',
        family: 'cipher',
        confidence: 0.46,
        reason: `Index of coincidence ${ic.toFixed(3)} sits in the polyalphabetic band — classic Vigenère/Beaufort/Le Gronsfeld territory.`,
        opId: 'vigenere-breaker',
        note: 'Run Kasiski examination + the Vigenère breaker op — length first, then the key.'
      });
    }
    if (englishScore(trimmed) < 0.35) {
      const reversed = [...trimmed].reverse().join('');
      if (englishScore(reversed) > 0.6) {
        add({
          id: 'reversed',
          label: 'Reversed text (or RTL trick)',
          family: 'cipher',
          confidence: 0.78,
          reason: 'Backwards it reads like plain English.',
          opId: 'reverse-text',
          decoded: capText(reversed)
        });
      }
    }
  }

  // --- dedupe, threshold, rank ---
  const seen = new Set<string>();
  const out: DetectHit[] = [];
  for (const h of hits.sort((a, b) => b.confidence - a.confidence)) {
    if (h.confidence < 0.34 && !h.oneWay && !h.needsKey) continue;
    const key = h.id + '|' + (h.decoded ?? h.label);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
    if (out.length >= 9) break;
  }
  if (out.length === 0) {
    out.push(undetermined(prof));
  }
  return out.slice(0, 9);
}

function undetermined(prof: SignalProfile): DetectHit {
  const randomish = prof.entropy > 4.4 && prof.distinct > 45;
  return {
    id: 'undetermined',
    label: randomish
      ? 'No structure — looks random, encrypted, or compressed'
      : 'No structure identified',
    family: 'unknown',
    confidence: 0.18,
    reason: randomish
      ? 'High entropy with a wide character set — typical of modern ciphertext, keys, or hash output.'
      : 'None of the known signatures matched. It may be a keyed cipher, a very short sample, or an obscure encoding.',
    note: 'Try the ENCODING DETECTOR op, or longer input — short samples are genuinely ambiguous.'
  };
}
