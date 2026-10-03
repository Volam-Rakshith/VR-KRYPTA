// Encodings: byte-to-text transport formats. Distinct from codes (which map
// symbols) and from ciphers (which are keyed). All validate malformed input.
import { defineOp } from './core/registry';
import { textValue, bytesValue } from './core/types';
import { utf8, bytesToHex, bytesToBigInt, bigIntToBytes } from '../utils/bytes';

/* ------------------------------- BASE64 FAMILY ---------------------------- */

function b64encode(bytes: Uint8Array, alphabet: string, pad: string): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
    const n = (b0 << 16) | ((b1 ?? 0) << 8) | (b2 ?? 0);
    out += alphabet[(n >> 18) & 63] + alphabet[(n >> 12) & 63];
    out += b1 === undefined ? pad : alphabet[(n >> 6) & 63];
    out += b2 === undefined ? pad : alphabet[n & 63];
  }
  return out;
}

function b64decode(s: string, alphabet: string, pad: string, label: string): Uint8Array {
  const clean = s.replace(/\s+/g, '');
  if (pad && clean.length % 4 !== 0) throw new Error(`${label} length (${clean.length}) is not a multiple of 4 — input may be truncated.`);
  const idx = new Map([...alphabet].map((c, i) => [c, i]));
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const chunk = clean.slice(i, i + 4);
    let n = 0, padCount = 0;
    for (let j = 0; j < 4; j++) {
      const c = chunk[j];
      if (c === pad) { padCount++; n <<= 6; continue; }
      if (c === undefined) { padCount++; n <<= 6; continue; }
      const v = idx.get(c);
      if (v === undefined) throw new Error(`"${c}" is not in the ${label} alphabet.`);
      n = (n << 6) | v;
    }
    bytes.push((n >> 16) & 255);
    if (padCount < 2) bytes.push((n >> 8) & 255);
    if (padCount < 1) bytes.push(n & 255);
  }
  return new Uint8Array(bytes);
}

const B64_STD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function base64Op(urlSafe: boolean) {
  const alpha = urlSafe ? B64_URL : B64_STD;
  return defineOp({
    id: urlSafe ? 'base64url' : 'base64',
    name: urlSafe ? 'Base64URL (RFC 4648 §5)' : 'Base64 (RFC 4648)',
    category: 'encodings',
    description: urlSafe
      ? 'URL- and filename-safe Base64: "+" and "/" replaced by "-" and "_", padding optional.'
      : 'The standard byte-to-text encoding: 3 bytes become 4 characters from a 64-symbol alphabet.',
    aliases: urlSafe ? ['base64 url safe', 'b64url', 'jwt encoding'] : ['base 64', 'b64', 'btoa', 'atob'],
    tags: ['encoding', 'base64', 'web', 'bytes'],
    input: 'text',
    output: 'encoded',
    reversible: true,
    engine: 'typescript',
    options: [
      { type: 'toggle', key: 'hexInput', label: 'Input is hexadecimal bytes', default: false, help: 'Decode hex text into bytes before Base64-encoding.' }
    ],
    actions: [
      {
        id: 'encode', label: 'Encode', kind: 'encode',
        run: (v, o) => {
          const bytes = o.hexInput
            ? (() => { const clean = v.text.replace(/[^0-9a-fA-F]/g, ''); const b = new Uint8Array(clean.length / 2); for (let i = 0; i < b.length; i++) b[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16); return b; })()
            : (v.bytes ?? utf8.encode(v.text));
          let out = b64encode(bytes, alpha, '=');
          if (urlSafe) out = out.replace(/=+$/, '');
          return textValue(out, 'encoded');
        }
      },
      {
        id: 'decode', label: 'Decode', kind: 'decode',
        run: (v) => {
          let s = v.text.replace(/\s+/g, '');
          if (urlSafe) while (s.length % 4) s += '=';
          const bytes = b64decode(s, alpha, '=', 'Base64' + (urlSafe ? 'URL' : ''));
          try {
            return textValue(utf8.decodeStrict(bytes));
          } catch {
            return bytesValue(bytes);
          }
        }
      }
    ],
    examples: urlSafe
      ? [{ label: 'URL-safe', input: 'sure? yes!' }]
      : [{ label: 'Classic', input: 'Transform Information.' }]
  });
}
base64Op(false);
base64Op(true);

/* --------------------------------- BASE32 --------------------------------- */

const B32_STD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function b32encode(bytes: Uint8Array): string {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32_STD[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_STD[(value << (5 - bits)) & 31];
  while (out.length % 8) out += '=';
  return out;
}

function b32decode(s: string): Uint8Array {
  const clean = s.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  const idx = new Map([...B32_STD].map((c, i) => [c, i]));
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const c of clean) {
    const v = idx.get(c);
    if (v === undefined) throw new Error(`"${c}" is not in the Base32 alphabet (A–Z 2–7).`);
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

defineOp({
  id: 'base32',
  name: 'Base32 (RFC 4648)',
  category: 'encodings',
  description: 'Case-insensitive byte-to-text encoding using A–Z and 2–7 with "=" padding — common in TOTP secrets and DNS-safe data.',
  aliases: ['base 32', 'b32', 'totp secret'],
  tags: ['encoding', 'base32', 'bytes'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    { id: 'encode', label: 'Encode', kind: 'encode', run: (v) => textValue(b32encode(v.bytes ?? utf8.encode(v.text)), 'encoded') },
    {
      id: 'decode', label: 'Decode', kind: 'decode',
      run: (v) => {
        const bytes = b32decode(v.text);
        try { return textValue(utf8.decodeStrict(bytes)); } catch { return bytesValue(bytes); }
      }
    }
  ],
  examples: [{ label: 'RFC vector', input: 'foobar' }]
});

/* --------------------------------- BASE58 --------------------------------- */

const B58_BTC = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function b58encode(bytes: Uint8Array): string {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  let n = bytesToBigInt(bytes);
  let out = '';
  while (n > 0n) {
    out = B58_BTC[Number(n % 58n)] + out;
    n /= 58n;
  }
  return '1'.repeat(zeros) + out;
}

function b58decode(s: string): Uint8Array {
  const idx = new Map([...B58_BTC].map((c, i) => [c, i]));
  let zeros = 0;
  while (zeros < s.length && s[zeros] === '1') zeros++;
  let n = 0n;
  for (const c of s.trim()) {
    const v = idx.get(c);
    if (v === undefined) throw new Error(`"${c}" is not in the Base58 alphabet (no 0, O, I or l).`);
    n = n * 58n + BigInt(v);
  }
  const body = bigIntToBytes(n, 0);
  const out = new Uint8Array(zeros + body.length);
  out.set(body, zeros);
  return out;
}

defineOp({
  id: 'base58',
  name: 'Base58 (Bitcoin alphabet)',
  category: 'encodings',
  description: 'Byte encoding that drops visually ambiguous characters (0, O, I, l) — known from Bitcoin addresses and IPFS hashes.',
  aliases: ['base 58', 'b58', 'bitcoin alphabet'],
  tags: ['encoding', 'base58', 'crypto-address', 'bytes'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    { id: 'encode', label: 'Encode', kind: 'encode', run: (v) => textValue(b58encode(v.bytes ?? utf8.encode(v.text)), 'encoded') },
    {
      id: 'decode', label: 'Decode', kind: 'decode',
      run: (v) => {
        const bytes = b58decode(v.text);
        try { return textValue(utf8.decodeStrict(bytes)); } catch { return bytesValue(bytes); }
      }
    }
  ],
  examples: [{ label: 'Hello world', input: 'Hello World!' }],
  docs: 'Leading zero bytes are preserved as leading "1" characters, matching the Bitcoin convention.'
});

/* -------------------------------- BASE85 (Ascii85) ------------------------ */

const A85_ZERO = 'z'.charCodeAt(0);

function a85encode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 4) {
    const slice = bytes.slice(i, i + 4);
    const padded = new Uint8Array(4);
    padded.set(slice);
    const n = (padded[0] * 2 ** 24 + padded[1] * 2 ** 16 + padded[2] * 2 ** 8 + padded[3]) >>> 0;
    let block = '';
    let x = n;
    for (let k = 0; k < 5; k++) {
      block = String.fromCharCode(33 + (x % 85)) + block;
      x = Math.floor(x / 85);
    }
    if (slice.length === 4 && n === 0) block = 'z';
    out += slice.length === 4 ? block : block.slice(0, slice.length + 1);
  }
  return out;
}

function a85decode(s: string): Uint8Array {
  const out: number[] = [];
  let i = 0;
  const clean = s.replace(/\s+/g, '');
  while (i < clean.length) {
    if (clean.charCodeAt(i) === A85_ZERO) { out.push(0, 0, 0, 0); i++; continue; }
    const block = clean.slice(i, i + 5);
    if (block.length < 5) {
      let x = 0;
      const padded = block + 'u'.repeat(5 - block.length);
      for (const c of padded) {
        const v = c.charCodeAt(0) - 33;
        if (v < 0 || v > 84) throw new Error(`"${c}" is outside the Ascii85 range.`);
        x = x * 85 + v;
      }
      const bytes = [Math.floor(x / 2 ** 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255];
      out.push(...bytes.slice(0, block.length - 1));
    } else {
      let x = 0;
      for (const c of block) {
        const v = c.charCodeAt(0) - 33;
        if (v < 0 || v > 84) throw new Error(`"${c}" is outside the Ascii85 range.`);
        x = x * 85 + v;
      }
      if (x > 0xffffffff) throw new Error('Ascii85 block exceeds the 32-bit maximum.');
      out.push(Math.floor(x / 2 ** 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255);
    }
    i += block.length === 0 ? 1 : block.length;
  }
  return new Uint8Array(out);
}

defineOp({
  id: 'base85',
  name: 'Ascii85 / Base85',
  category: 'encodings',
  description: 'Adobe\'s byte-to-text encoding (used in PDF and PostScript): 4 bytes into 5 ASCII characters, "z" shorthand for zero blocks.',
  aliases: ['ascii85', 'base 85', 'b85', 'z85?'],
  tags: ['encoding', 'base85', 'pdf', 'bytes'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    { id: 'encode', label: 'Encode', kind: 'encode', run: (v) => textValue(a85encode(v.bytes ?? utf8.encode(v.text)), 'encoded') },
    {
      id: 'decode', label: 'Decode', kind: 'decode',
      run: (v) => {
        const bytes = a85decode(v.text);
        try { return textValue(utf8.decodeStrict(bytes)); } catch { return bytesValue(bytes); }
      }
    }
  ],
  examples: [{ label: 'Hello', input: 'Hello World!' }]
});

/* ---------------------------- PERCENT ENCODING ----------------------------- */

defineOp({
  id: 'percent-encoding',
  name: 'Percent Encoding (URL)',
  category: 'encodings',
  description: 'Escapes characters for safe use in URLs, with component and query-string modes.',
  aliases: ['url encode', 'url decode', 'percent encode', 'uri encoding', '%20'],
  tags: ['encoding', 'url', 'web'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'browser',
  options: [
    { type: 'select', key: 'mode', label: 'Mode', default: 'component', options: [
      { value: 'component', label: 'Component (escape / ? & = too)' },
      { value: 'uri', label: 'Full URI (keep : / ? # & etc.)' },
      { value: 'form', label: 'Form / query (space becomes +)' }
    ] }
  ],
  actions: [
    {
      id: 'encode', label: 'Encode', kind: 'encode',
      run: (v, o) => {
        const mode = String(o.mode ?? 'component');
        let out = mode === 'uri' ? encodeURI(v.text) : encodeURIComponent(v.text);
        if (mode === 'form') out = out.replace(/%20/g, '+');
        return textValue(out, 'encoded');
      }
    },
    {
      id: 'decode', label: 'Decode', kind: 'decode',
      run: (v, o) => {
        const mode = String(o.mode ?? 'component');
        const s = mode === 'form' ? v.text.replace(/\+/g, ' ') : v.text;
        try {
          return textValue(decodeURIComponent(s.replace(new RegExp('%(?![0-9a-fA-F]{2})', 'g'), '%25')));
        } catch {
          throw new Error('Malformed percent encoding — every "%" must be followed by two hex digits.');
        }
      }
    }
  ],
  examples: [{ label: 'Query value', input: 'a=b & c=d?' }]
});

/* ------------------------------ HTML ENTITIES ------------------------------ */

const HTML_NAMED: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  '©': '&copy;', '®': '&reg;', '™': '&trade;', '€': '&euro;', '£': '&pound;',
  '¥': '&yen;', '¢': '&cent;', '°': '&deg;', '±': '&plusmn;', '×': '&times;',
  '÷': '&divide;', '…': '&hellip;', '–': '&ndash;', '—': '&mdash;', ' ': '&nbsp;'
};

defineOp({
  id: 'html-entities',
  name: 'HTML Entities',
  category: 'encodings',
  description: 'Escapes text for HTML: named entities where they exist (&amp;, &copy;), numeric character references otherwise.',
  aliases: ['html escape', 'html encode', 'entities', '&amp;'],
  tags: ['encoding', 'html', 'web', 'xss'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'browser',
  options: [
    { type: 'toggle', key: 'encodeAll', label: 'Encode every non-ASCII character', default: false }
  ],
  actions: [
    {
      id: 'encode', label: 'Encode', kind: 'encode',
      run: (v, o) => {
        let out = '';
        for (const ch of v.text) {
          if (HTML_NAMED[ch]) { out += HTML_NAMED[ch]; continue; }
          if (o.encodeAll && ch.charCodeAt(0) > 127) {
            const cp = ch.codePointAt(0)!;
            out += '&#' + cp + ';';
            if (cp > 0xffff) continue; // for-of already yields the full code point
            continue;
          }
          out += ch;
        }
        return textValue(out, 'encoded');
      }
    },
    {
      id: 'decode', label: 'Decode', kind: 'decode',
      run: (v) => {
        const doc = typeof document !== 'undefined' ? document : null;
        if (doc) {
          const ta = doc.createElement('textarea');
          ta.innerHTML = v.text;
          return textValue(ta.value);
        }
        return textValue(
          v.text
            .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
            .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
            .replace(/&(amp|lt|gt|quot|apos|copy|reg|trade|euro|pound|yen|cent|deg|plusmn|times|divide|hellip|ndash|mdash|nbsp);/g, (m) => {
              const rev: Record<string, string> = {};
              for (const [k, val] of Object.entries(HTML_NAMED)) { rev[val] = k; rev[k === "'" ? '&#39;' : val] = rev[val] ?? k; }
              return rev[m] ?? m;
            })
        );
      }
    }
  ],
  examples: [{ label: 'Markup', input: '<b>"Tom & Jerry"</b> © 2026' }]
});

/* ---------------------------- QUOTED-PRINTABLE ----------------------------- */

defineOp({
  id: 'quoted-printable',
  name: 'Quoted-Printable',
  category: 'encodings',
  description: 'MIME transfer encoding (RFC 2045): 7-bit-safe text using "=XX" byte escapes, soft line breaks at 76 columns.',
  aliases: ['qp encoding', 'mime encoding', '=3D'],
  tags: ['encoding', 'mime', 'email'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    {
      id: 'encode', label: 'Encode', kind: 'encode',
      run: (v) => {
        const bytes = utf8.encode(v.text);
        let line = '';
        const lines: string[] = [];
        const pushToken = (tok: string) => {
          if (line.length + tok.length > 75) { lines.push(line + '='); line = ''; }
          line += tok;
        };
        for (let i = 0; i < bytes.length; i++) {
          const b = bytes[i];
          if (b === 0x0a) { lines.push(line); line = ''; continue; }
          if (b === 0x0d) continue;
          const printable = (b >= 33 && b <= 60) || (b >= 62 && b <= 126);
          if (printable) pushToken(String.fromCharCode(b));
          else if (b === 0x20 || b === 0x09) pushToken(String.fromCharCode(b));
          else pushToken('=' + b.toString(16).toUpperCase().padStart(2, '0'));
        }
        lines.push(line);
        return textValue(lines.join('\r\n'), 'encoded');
      }
    },
    {
      id: 'decode', label: 'Decode', kind: 'decode',
      run: (v) => {
        const joined = v.text.replace(/=\r?\n/g, '');
        const bad = joined.match(/=(?![0-9a-fA-F]{2})/);
        if (bad) throw new Error('Malformed quoted-printable: "=" must be followed by two hex digits or a line break.');
        const bytes: number[] = [];
        for (let i = 0; i < joined.length; i++) {
          if (joined[i] === '=') {
            bytes.push(parseInt(joined.slice(i + 1, i + 3), 16));
            i += 2;
          } else bytes.push(joined.charCodeAt(i) & 0xff);
        }
        return textValue(utf8.decodeStrict(new Uint8Array(bytes)));
      }
    }
  ],
  examples: [{ label: 'Email body', input: 'Café — €5' }]
});
