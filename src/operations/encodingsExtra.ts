// Encodings — second wave: numeric bases, archive-era transport formats,
// language escapers, Punycode, and Unicode toolset.
import { defineOp } from './core/registry';
import { textValue, bytesValue } from './core/types';
import { utf8, bytesToBigInt, bigIntToBytes, hexToBytes } from '../utils/bytes';

/* --------------------------- base36 / base62 ------------------------------- */

function bigintBaseOp(cfg: { id: string; name: string; alphabet: string; desc: string; aliases?: string[] }) {
  const n = BigInt(cfg.alphabet.length);
  defineOp({
    id: cfg.id,
    name: cfg.name,
    category: 'encodings',
    description: cfg.desc,
    aliases: cfg.aliases,
    tags: ['encoding', 'numeric-base'],
    input: 'text',
    output: 'encoded',
    reversible: true,
    engine: 'typescript',
    options: [
      { type: 'select', key: 'direction', label: 'Numbers or bytes?', default: 'numbers', options: [
        { value: 'numbers', label: 'Text contains decimal numbers' },
        { value: 'bytes', label: 'Encode raw bytes as one big number' }
      ] }
    ],
    actions: [
      {
        id: 'encode', label: 'Encode', kind: 'encode',
        run: (v, o) => {
          if (String(o.direction) === 'bytes') {
            let x = bytesToBigInt(v.bytes ?? utf8.encode(v.text));
            if (x === 0n) return textValue(cfg.alphabet[0], 'encoded');
            let out = '';
            while (x > 0n) { out = cfg.alphabet[Number(x % n)] + out; x /= n; }
            return textValue(out, 'encoded');
          }
          const toks = v.text.trim().split(/\s+/);
          return textValue(toks.map((t) => {
            if (!/^[0-9]+$/.test(t)) throw new Error(`"${t}" is not a non-negative integer.`);
            let x = BigInt(t), out = '';
            if (x === 0n) return cfg.alphabet[0];
            while (x > 0n) { out = cfg.alphabet[Number(x % n)] + out; x /= n; }
            return out;
          }).join(' '), 'encoded');
        }
      },
      {
        id: 'decode', label: 'Decode', kind: 'decode',
        run: (v, o) => {
          const idx = new Map([...cfg.alphabet].map((c, i) => [c, BigInt(i)]));
          const toks = v.text.trim().split(/\s+/);
          if (String(o.direction) === 'bytes') {
            let x = 0n;
            for (const c of v.text.trim()) {
              const d = idx.get(c);
              if (d === undefined) throw new Error(`"${c}" is not in the ${cfg.name} alphabet (it IS case-sensitive).`);
              x = x * n + d;
            }
            const bytes = bigIntToBytes(x, 0);
            try { return textValue(utf8.decodeStrict(bytes)); } catch { return bytesValue(bytes); }
          }
          return textValue(toks.map((t) => {
            let x = 0n;
            for (const c of t) {
              const d = idx.get(c);
              if (d === undefined) throw new Error(`"${c}" is not in the ${cfg.name} alphabet (it IS case-sensitive).`);
              x = x * n + d;
            }
            return x.toString();
          }).join(' '));
        }
      }
    ],
    examples: [{ label: 'Big number', input: '9876543210' }]
  });
}

bigintBaseOp({
  id: 'base36',
  name: 'Base36',
  alphabet: '0123456789abcdefghijklmnopqrstuvwxyz',
  desc: 'Number system over 0-9a-z — seen in short URLs and database slugs. Encodes integers (or byte strings as one big integer).'
});

bigintBaseOp({
  id: 'base62',
  name: 'Base62',
  alphabet: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  desc: 'Alphanumeric base using 0-9a-zA-Z — popular for URL shorteners. Case-sensitive by design.',
  aliases: ['base 62', 'base-62']
});

/* -------------------------------- basE91 ---------------------------------- */

const B91 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&()*+,./:;<=>?@[]^_`{|}~"';

function b91encode(data: Uint8Array): string {
  let b = 0, n = 0, out = '';
  for (const byte of data) {
    b |= byte << n;
    n += 8;
    if (n > 13) {
      let v = b & 8191;
      if (v > 88) { b >>= 13; n -= 13; }
      else { v = b & 16383; b >>= 14; n -= 14; }
      out += B91[v % 91] + B91[Math.floor(v / 91)];
    }
  }
  if (n > 0) out += B91[b % 91] + (n > 7 || b > 90 ? B91[Math.floor(b / 91)] : '');
  return out;
}

function b91decode(s: string): Uint8Array {
  let v = -1, b = 0, n = 0;
  const out: number[] = [];
  for (const c of s.trim()) {
    if (/\s/.test(c)) continue;
    const d = B91.indexOf(c);
    if (d === -1) throw new Error(`"${c}" is not in the basE91 alphabet.`);
    if (v < 0) v = d;
    else {
      v += d * 91;
      b |= v << n;
      n += (v % 8192) > 88 ? 13 : 14;
      do {
        out.push(b & 255);
        b >>= 8;
        n -= 8;
      } while (n > 7);
      v = -1;
    }
  }
  if (v > -1) out.push(((b | v << n) & 255));
  return new Uint8Array(out);
}

defineOp({
  id: 'base91',
  name: 'basE91',
  category: 'encodings',
  description: 'Joachim Henke\'s dense byte encoding: ~23% overhead vs Base64\'s 33%, at the cost of a much busier alphabet.',
  aliases: ['base 91', 'b91'],
  tags: ['encoding', 'base91', 'bytes'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    { id: 'encode', label: 'Encode', kind: 'encode', run: (v) => textValue(b91encode(v.bytes ?? utf8.encode(v.text)), 'encoded') },
    {
      id: 'decode', label: 'Decode', kind: 'decode',
      run: (v) => {
        const bytes = b91decode(v.text);
        try { return textValue(utf8.decodeStrict(bytes)); } catch { return bytesValue(bytes); }
      }
    }
  ],
  examples: [{ label: 'Hello', input: 'Hello World!' }],
  docs: 'Reference-algorithm bit packing, including the 13/14-bit edge cases (v > 88 rule).'
});

/* ---------------------------------- z85 ----------------------------------- */

const Z85 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#';

defineOp({
  id: 'z85',
  name: 'Z85 (ZeroMQ Base85)',
  category: 'encodings',
  description: 'ZeroMQ\'s string-safe Base85: 4 bytes ↔ 5 characters, no escapes needed anywhere. Input length must be a multiple of 4 bytes.',
  aliases: ['z85', 'zeromq base85', '85'],
  tags: ['encoding', 'base85', 'zeromq'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    {
      id: 'encode', label: 'Encode', kind: 'encode',
      run: (v) => {
        const data = v.bytes ?? utf8.encode(v.text);
        if (data.length % 4 !== 0) throw new Error(`Z85 requires a byte count divisible by 4 (you have ${data.length}). Pad the input — Z85 has no padding concept.`);
        let out = '';
        for (let i = 0; i < data.length; i += 4) {
          let x = data[i] * 2 ** 24 + data[i + 1] * 2 ** 16 + data[i + 2] * 2 ** 8 + data[i + 3];
          const block: string[] = [];
          for (let k = 0; k < 5; k++) { block.unshift(Z85[x % 85]); x = Math.floor(x / 85); }
          out += block.join('');
        }
        return textValue(out, 'encoded');
      }
    },
    {
      id: 'decode', label: 'Decode', kind: 'decode',
      run: (v) => {
        const s = v.text.replace(/\s+/g, '');
        if (s.length % 5 !== 0) throw new Error(`Z85 input must be a multiple of 5 characters (you have ${s.length}).`);
        const out: number[] = [];
        for (let i = 0; i < s.length; i += 5) {
          let x = 0;
          for (let k = 0; k < 5; k++) {
            const d = Z85.indexOf(s[i + k]);
            if (d === -1) throw new Error(`"${s[i + k]}" is not in the Z85 alphabet.`);
            x = x * 85 + d;
          }
          if (x > 0xffffffff) throw new Error('Z85 block value exceeds 2³²−1 — invalid input.');
          out.push((x >>> 24) & 255, (x >>> 16) & 255, (x >>> 8) & 255, x & 255);
        }
        const bytes = new Uint8Array(out);
        try { return textValue(utf8.decodeStrict(bytes)); } catch { return bytesValue(bytes); }
      }
    }
  ],
  examples: [{ label: 'ZMQ vector', input: '\x86\x4F\xD2\x6F\xB5\x59\xF7\x5B', options: { direction: 'numbers' } }],
  docs: 'Reference vector: bytes 86 4F D2 6F B5 59 F7 5B encode to "HelloWorld".'
});

/* ------------------------------- punycode ---------------------------------- */

const PC_BASE = 36, PC_TMIN = 1, PC_TMAX = 26, PC_SKEW = 38, PC_DAMP = 700, PC_INITIAL_BIAS = 72, PC_INITIAL_N = 128;
const PC_DIGITS = 'abcdefghijklmnopqrstuvwxyz0123456789';

function pcAdapt(delta: number, numpoints: number, first: boolean): number {
  delta = first ? Math.floor(delta / PC_DAMP) : delta >> 1;
  delta += Math.floor(delta / numpoints);
  let k = 0;
  while (delta > Math.floor(((PC_BASE - PC_TMIN) * PC_TMAX) / 2)) {
    delta = Math.floor(delta / (PC_BASE - PC_TMIN));
    k += PC_BASE;
  }
  return k + Math.floor(((PC_BASE - PC_TMIN + 1) * delta) / (delta + PC_SKEW));
}

function punycodeEncode(input: string): string {
  const cps = [...input].map((c) => c.codePointAt(0)!);
  let out = '';
  const basics: number[] = [];
  for (const cp of cps) if (cp < 128) basics.push(cp);
  out += basics.map((c) => String.fromCharCode(c)).join('');
  const h = basics.length;
  const b = basics.length;
  if (b > 0 && h < cps.length) out += '-';
  let n = PC_INITIAL_N, delta = 0, bias = PC_INITIAL_BIAS;
  for (const cp of cps) if (cp < 128) {} // handled
  let processed = h;
  while (processed < cps.length) {
    let m = Infinity;
    for (const cp of cps) if (cp >= n && cp < m) m = cp;
    delta += (m - n) * (processed + 1);
    n = m;
    for (const cp of cps) {
      if (cp < n) delta++;
      else if (cp === n) {
        let q = delta;
        for (let k = PC_BASE; ; k += PC_BASE) {
          const t = k <= bias ? PC_TMIN : k >= bias + PC_TMAX ? PC_TMAX : k - bias;
          if (q < t) break;
          out += PC_DIGITS[t + ((q - t) % (PC_BASE - t))];
          q = Math.floor((q - t) / (PC_BASE - t));
        }
        out += PC_DIGITS[q];
        bias = pcAdapt(delta, processed + 1, processed === b);
        delta = 0;
        processed++;
      }
    }
    delta++;
    n++;
  }
  return out;
}

function punycodeDecode(input: string): string {
  const lastDash = input.lastIndexOf('-');
  const basics = lastDash >= 0 ? input.slice(0, lastDash) : '';
  let payload = lastDash >= 0 ? input.slice(lastDash + 1) : input;
  const cps: number[] = [...basics].map((c) => c.codePointAt(0)!);
  let n = PC_INITIAL_N, i = 0, bias = PC_INITIAL_BIAS, p = 0;
  while (p < payload.length) {
    const oldi = i;
    let w = 1;
    for (let k = PC_BASE; ; k += PC_BASE) {
      if (p >= payload.length) throw new Error('Truncated punycode payload.');
      const d = PC_DIGITS.indexOf(payload[p++].toLowerCase());
      if (d < 0) throw new Error(`"${payload[p - 1]}" is not a valid punycode digit.`);
      i += d * w;
      const t = k <= bias ? PC_TMIN : k >= bias + PC_TMAX ? PC_TMAX : k - bias;
      if (d < t) break;
      w *= PC_BASE - t;
    }
    const outLen = cps.length + 1;
    bias = pcAdapt(i - oldi, outLen, oldi === 0);
    n += Math.floor(i / outLen);
    i = i % outLen;
    cps.splice(i, 0, n);
    i++;
  }
  return cps.map((c) => String.fromCodePoint(c)).join('');
}

defineOp({
  id: 'punycode',
  name: 'Punycode / IDN',
  category: 'encodings',
  description: 'RFC 3492 encoding for internationalized domain names: münchen → mnchen-3ya (add the xn-- prefix for DNS).',
  aliases: ['idn', 'internationalized domain', 'xn--', 'puny'],
  tags: ['encoding', 'dns', 'unicode', 'web'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  options: [
    { type: 'toggle', key: 'dnsPrefix', label: 'Add / expect xn-- prefix', default: false }
  ],
  actions: [
    {
      id: 'encode', label: 'To punycode', kind: 'convert',
      run: (v, o) => {
        const label = v.text.trim();
        if (!label) throw new Error('Empty label.');
        if (/\s/.test(label)) throw new Error('Domain labels cannot contain spaces — encode one label at a time.');
        const ascii = /^[\x20-\x7e]*$/.test(label);
        if (ascii) return textValue(label, 'encoded');
        const pc = punycodeEncode(label.toLowerCase());
        return textValue(o.dnsPrefix ? 'xn--' + pc : pc, 'encoded');
      }
    },
    {
      id: 'decode', label: 'From punycode', kind: 'convert',
      run: (v, o) => {
        let label = v.text.trim().toLowerCase();
        if (label.startsWith('xn--')) label = label.slice(4);
        else if (o.dnsPrefix) throw new Error('Expected an xn-- prefixed label.');
        return textValue(punycodeDecode(label));
      }
    }
  ],
  examples: [{ label: 'German city', input: 'münchen', options: { dnsPrefix: true } }],
  docs: 'Case is folded to lowercase per IDNA conventions. RFC 3492 bootstrapping is implemented in full, including the adaptive bias.'
});

/* ------------------------------- uuencode ---------------------------------- */

defineOp({
  id: 'uuencode',
  name: 'UUencode / UUdecode',
  category: 'encodings',
  historicalName: 'uucp era (1980s)',
  description: 'The original binary-to-text mail format: (length-prefixed) lines of backtick-free 6-bit groups.',
  aliases: ['uuencode', 'uudecode', 'uue', 'xxencode?'],
  tags: ['encoding', 'legacy', 'email', 'bytes'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    {
      id: 'encode', label: 'Encode', kind: 'encode',
      run: (v) => {
        const data = v.bytes ?? utf8.encode(v.text);
        if (data.length > 45 * 200) throw new Error('Display limit: ~9 KB.');
        const enc6 = (x: number) => String.fromCharCode((x & 63) === 0 ? 96 : (x & 63) + 32);
        const lines: string[] = [];
        for (let i = 0; i < data.length; i += 45) {
          const chunk = data.slice(i, i + 45);
          let line = enc6(chunk.length);
          for (let j = 0; j < chunk.length; j += 3) {
            const a = chunk[j], b = chunk[j + 1] ?? 0, c = chunk[j + 2] ?? 0;
            line += enc6(a >> 2) + enc6(((a << 4) | (b >> 4)) & 63) + enc6(((b << 2) | (c >> 6)) & 63) + enc6(c & 63);
          }
          lines.push(line);
        }
        lines.push('`', 'end');
        return textValue(lines.join('\n'), 'encoded');
      }
    },
    {
      id: 'decode', label: 'Decode', kind: 'decode',
      run: (v) => {
        const dec = (ch: string) => ch === '`' ? 0 : ch.charCodeAt(0) - 32;
        const out: number[] = [];
        for (const rawLine of v.text.split('\n')) {
          const line = rawLine.replace(/\r$/, '');
          if (!line || line === '`' || line === 'end' || line.startsWith('begin')) continue;
          const len = dec(line[0]);
          if (len < 0 || len > 45) throw new Error(`Bad UU length character at line start.`);
          let body = line.slice(1);
          const bits: number[] = [];
          for (let i = 0; i + 4 <= body.length + 3; i += 4) {
            const q = body.slice(i, i + 4).padEnd(4, '`');
            const [a, b, c, d] = [...q].map(dec);
            bits.push((a << 2) | (b >> 4), ((b << 4) | (c >> 2)) & 255, ((c << 6) | d) & 255);
          }
          out.push(...bits.slice(0, len));
        }
        const bytes = new Uint8Array(out);
        try { return textValue(utf8.decodeStrict(bytes)); } catch { return bytesValue(bytes); }
      }
    }
  ],
  examples: [{ label: 'Cat', input: 'The uucp cat lives.' }],
  docs: 'Uses the modern backtick-for-zero convention. The trailing "`" + "end" lines are emitted and (along with an optional "begin" header) skipped on decode.'
});

/* ---------------------------------- yEnc ----------------------------------- */

defineOp({
  id: 'yenc',
  name: 'yEnc (core encoding)',
  category: 'encodings',
  description: 'Usenet binary format: bytes shifted +42 mod 256, with \x00 \x09 \x0A \x0D = escaped via "=". This op encodes/decodes the core byte transform.',
  aliases: ['yencode', 'usenet encoding'],
  tags: ['encoding', 'usenet', 'bytes'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    {
      id: 'encode', label: 'Encode', kind: 'encode',
      run: (v) => {
        const data = v.bytes ?? utf8.encode(v.text);
        const ESCAPE = new Set([0, 9, 10, 13, 61]);
        let out = '';
        for (const b of data) {
          const y = (b + 42) & 255;
          if (ESCAPE.has(y)) out += '=' + String.fromCharCode((y + 64) & 255);
          else out += String.fromCharCode(y);
        }
        return textValue(out, 'encoded');
      }
    },
    {
      id: 'decode', label: 'Decode', kind: 'decode',
      run: (v) => {
        const s = v.text;
        const out: number[] = [];
        for (let i = 0; i < s.length; i++) {
          let y = s.charCodeAt(i);
          if (y === 61) { // '='
            const nxt = s.charCodeAt(++i);
            if (Number.isNaN(nxt)) throw new Error('yEnc input ends with a dangling "=" escape.');
            y = (nxt - 64) & 255;
          }
          if (y > 255) throw new Error(`Character U+${y.toString(16).padStart(4, '0')} is not a single-byte yEnc character.`);
          out.push((y - 42) & 255);
        }
        const bytes = new Uint8Array(out);
        try { return textValue(utf8.decodeStrict(bytes)); } catch { return bytesValue(bytes); }
      }
    }
  ],
  docs: 'Header lines (=ybegin/=ypart/=yend) are part of the transport wrapper, not the core encoding — paste just the payload here.'
});

/* -------------------------------- data URI --------------------------------- */

defineOp({
  id: 'data-uri',
  name: 'Data URI Encoder / Parser',
  category: 'encodings',
  description: 'Build and decode data: URIs (RFC 2397) — embed small files directly in HTML/CSS without a network request.',
  aliases: ['data url', 'data:uri', 'inline asset', 'base64 image url'],
  tags: ['encoding', 'web', 'url'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  options: [{ type: 'text', key: 'mime', label: 'MIME type', default: 'text/plain' }],
  actions: [
    {
      id: 'encode', label: 'Build URI', kind: 'convert',
      run: (v, o) => {
        const mime = String(o.mime ?? 'text/plain').trim() || 'text/plain';
        const data = v.bytes ?? utf8.encode(v.text);
        const b64 = btoa(String.fromCharCode(...data.length < 65536 ? data : (() => { throw new Error('Use hex input for large binary (or paste Base64 content directly).'); })() as unknown as Uint8Array));
        return textValue(`data:${mime};base64,${b64}`, 'encoded');
      }
    },
    {
      id: 'decode', label: 'Parse URI', kind: 'convert',
      run: (v) => {
        const m = v.text.trim().match(/^data:([^;,]*)(;base64)?,(.*)$/is);
        if (!m) throw new Error('Not a data: URI. Expected data:[mime][;base64],payload');
        const [, mime, isB64, payload] = m;
        let bytes: Uint8Array;
        if (isB64) {
          try { bytes = Uint8Array.from(atob(payload), (c) => c.charCodeAt(0)); }
          catch { throw new Error('Invalid Base64 payload in the data URI.'); }
        } else bytes = utf8.encode(decodeURIComponent(payload));
        let body: string;
        try { body = utf8.decodeStrict(bytes); } catch { body = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(' '); }
        return textValue(`MIME type: ${mime || '(default text/plain)'}\nEncoding:  ${isB64 ? 'base64' : 'percent'}\nBytes:     ${bytes.length}\n\nPayload:\n${body}`);
      }
    }
  ],
  examples: [{ label: 'Plain text', input: 'Hello, inline world!' }]
});

/* ------------------------------ string escapers ---------------------------- */

defineOp({
  id: 'json-string-escaping',
  name: 'JSON String Escaping',
  category: 'encodings',
  description: 'Escape/unescape text exactly as JSON string literals require (\\n, \\", \\\\, \\uXXXX per JSON.stringify).',
  aliases: ['json escape', 'json encode string', 'json unescape'],
  tags: ['encoding', 'json', 'escaping'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'browser',
  actions: [
    { id: 'encode', label: 'Escape', kind: 'convert', run: (v) => textValue(JSON.stringify(v.text).slice(1, -1), 'encoded') },
    {
      id: 'decode', label: 'Unescape', kind: 'convert',
      run: (v) => {
        try { return textValue(JSON.parse(`"${v.text}"`) as string); }
        catch (e) { throw new Error(`Invalid JSON escapes: ${e instanceof Error ? e.message : e}`); }
      }
    }
  ],
  examples: [{ label: 'Quote & newline', input: 'She said "hi"\namong \\backslashes\\' }]
});

defineOp({
  id: 'c-string-escaping',
  name: 'C-Style String Escaping',
  category: 'encodings',
  description: 'Classic C escapes: \\n \\t \\r \\0 \\\\ \\" \\x41. Decoding also understands \\xHH and octal.',
  aliases: ['c escape', 'escape sequence', 'printf escapes'],
  tags: ['encoding', 'c', 'escaping'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    {
      id: 'encode', label: 'Escape', kind: 'convert',
      run: (v) => textValue(v.text.replace(/[\\\n\r\t\0"\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, (ch) => {
        const c = ch.charCodeAt(0);
        if (ch === '\\') return '\\\\';
        if (ch === '\n') return '\\n';
        if (ch === '\r') return '\\r';
        if (ch === '\t') return '\\t';
        if (ch === '"') return '\\"';
        if (c === 0) return '\\0';
        return '\\x' + c.toString(16).padStart(2, '0');
      }), 'encoded')
    },
    {
      id: 'decode', label: 'Unescape', kind: 'convert',
      run: (v) => textValue(v.text.replace(/\\(x[0-9a-fA-F]{2}|[0-7]{1,3}|n|r|t|0|\\|"|')/g, (m, g: string) => {
        if (g.startsWith('x')) return String.fromCharCode(parseInt(g.slice(1), 16));
        if (/^[0-7]/.test(g)) return String.fromCharCode(parseInt(g, 8));
        const map: Record<string, string> = { n: '\n', r: '\r', t: '\t', '0': '\0', '\\': '\\', '"': '"', "'": "'" };
        return map[g];
      }), 'text')
    }
  ],
  examples: [{ label: 'Escape me', input: 'line1\nline2\t"quoted"' }]
});

defineOp({
  id: 'js-string-escaping',
  name: 'JavaScript String Escaping',
  category: 'encodings',
  description: 'JS literal escapes: \\n, \\x41, \\u0041, \\u{1F600}. Decoding parses all three forms.',
  aliases: ['js escape', 'javascript unicode escape'],
  tags: ['encoding', 'javascript', 'escaping'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  options: [
    { type: 'select', key: 'nonAscii', label: 'Non-ASCII output', default: 'u', options: [
      { value: 'raw', label: 'Keep raw' },
      { value: 'u', label: '\\u0041 form' },
      { value: 'ubrace', label: '\\u{1F600} form' }
    ] }
  ],
  actions: [
    {
      id: 'encode', label: 'Escape', kind: 'convert',
      run: (v, o) => textValue([...v.text].map((ch) => {
        const cp = ch.codePointAt(0)!;
        if (ch === '\\') return '\\\\';
        if (ch === '\n') return '\\n';
        if (ch === '\r') return '\\r';
        if (ch === '\t') return '\\t';
        if (ch === '"') return '\\"';
        if (cp > 127 && String(o.nonAscii) !== 'raw') {
          if (cp > 0xffff || String(o.nonAscii) === 'ubrace') return `\\u{${cp.toString(16)}}`;
          return '\\u' + cp.toString(16).padStart(4, '0');
        }
        return ch;
      }).join(''), 'encoded')
    },
    {
      id: 'decode', label: 'Unescape', kind: 'convert',
      run: (v) => textValue(v.text.replace(/\\(u\{[0-9a-fA-F]{1,6}\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|n|r|t|\\|"|')/g, (m, g: string) => {
        if (g.startsWith('u{')) return String.fromCodePoint(parseInt(g.slice(2, -1), 16));
        if (g.startsWith('u')) return String.fromCharCode(parseInt(g.slice(1), 16));
        if (g.startsWith('x')) return String.fromCharCode(parseInt(g.slice(1), 16));
        const map: Record<string, string> = { n: '\n', r: '\r', t: '\t', '\\': '\\', '"': '"', "'": "'" };
        return map[g];
      }), 'text')
    }
  ],
  examples: [{ label: 'Unicode mix', input: 'const emoji = "🙂";' }]
});

defineOp({
  id: 'shell-escaping',
  name: 'Shell Argument Escaping (POSIX)',
  category: 'encodings',
  description: "Quote a string for safe POSIX shell use (single-quote + close-reopen idiom), and strip quotes back.",
  aliases: ['bash escape', 'shell quote', 'sh escape'],
  tags: ['encoding', 'shell', 'security'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  options: [{ type: 'toggle', key: 'forceQuotes', label: 'Always wrap in quotes', default: true }],
  actions: [
    {
      id: 'encode', label: 'Quote', kind: 'convert',
      run: (v, o) => {
        const s = v.text;
        if (!o.forceQuotes && /^[A-Za-z0-9_./:=-]+$/.test(s)) return textValue(s, 'encoded');
        return textValue("'" + s.replace(/'/g, `'\\''`) + "'", 'encoded');
      }
    },
    {
      id: 'decode', label: 'Unquote', kind: 'convert',
      run: (v) => {
        const s = v.text.trim();
        if (s.length >= 2 && s.startsWith("'") && s.endsWith("'")) {
          return textValue(s.slice(1, -1).replace(/'\\''/g, "'"));
        }
        throw new Error("Input is not a complete single-quoted POSIX shell string (must start and end with ').");
      }
    }
  ],
  examples: [{ label: 'Dangerous name', input: "it's a $file.txt" }],
  warnings: ['Escaping for display ≠ safe eval. Never pass user input to a shell without argument-array based APIs.']
});

defineOp({
  id: 'xml-escaping',
  name: 'XML Escaping',
  category: 'encodings',
  description: 'The five XML entities (&lt; &gt; &amp; &quot; &apos;) — stricter than HTML: numeric forms for everything else.',
  aliases: ['xml encode', 'xml entities'],
  tags: ['encoding', 'xml', 'web'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    {
      id: 'encode', label: 'Escape', kind: 'convert',
      run: (v) => textValue(v.text.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[ch]!)), 'encoded')
    },
    {
      id: 'decode', label: 'Unescape', kind: 'convert',
      run: (v) => textValue(
        v.text
          .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
          .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
          .replace(/&(lt|gt|amp|quot|apos);/g, (m, e) => ({ lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }[e as string]!))
      )
    }
  ],
  examples: [{ label: 'Element data', input: '<price currency="USD">5 & "change"</price>' }]
});

/* ------------------------ normalization & inspection ----------------------- */

defineOp({
  id: 'unicode-normalization',
  name: 'Unicode Normalization (NFC / NFD / NFKC / NFKD)',
  category: 'encodings',
  description: 'Canonical-equivalence transforms: é as one code point (NFC) vs e + combining accent (NFD), plus compatibility forms.',
  aliases: ['nfc', 'nfd', 'nfkc', 'normalize unicode'],
  tags: ['unicode', 'normalization'],
  input: 'text',
  output: 'text',
  reversible: false,
  lossy: false,
  engine: 'browser',
  options: [
    { type: 'select', key: 'form', label: 'Form', default: 'NFC', options: [
      { value: 'NFC', label: 'NFC — composed' },
      { value: 'NFD', label: 'NFD — decomposed' },
      { value: 'NFKC', label: 'NFKC — compat + composed' },
      { value: 'NFKD', label: 'NFKD — compat + decomposed' }
    ] },
    { type: 'toggle', key: 'showCodepoints', label: 'Show code points too', default: true }
  ],
  actions: [
    {
      id: 'convert', label: 'Normalize', kind: 'convert',
      run: (v, o) => {
        const form = String(o.form ?? 'NFC') as 'NFC' | 'NFD' | 'NFKC' | 'NFKD';
        const out = v.text.normalize(form);
        if (!o.showCodepoints) return textValue(out);
        const cps = [...out].map((c) => 'U+' + c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')).join(' ');
        return textValue(`${out}\n\nCode points (${form}):\n${cps}`);
      }
    }
  ],
  examples: [{ label: 'Accents', input: 'Café — ﬁle — ①' }],
  docs: 'NFKC/NFKD are compatibility-destroying transforms (① → 1, ﬁ → fi). NFC/NFD never change meaning, only representation.'
});

defineOp({
  id: 'surrogate-inspector',
  name: 'Surrogate-Pair Inspector',
  category: 'encodings',
  description: 'Explains UTF-16 surrogate pairs: which characters need them, the high/low halves, and how the halves combine.',
  aliases: ['surrogate pair', 'utf16 pairs', 'astral'],
  tags: ['unicode', 'utf-16', 'analysis'],
  input: 'text',
  output: 'text',
  reversible: false,
  engine: 'typescript',
  actions: [
    {
      id: 'analyze', label: 'Inspect', kind: 'analyze',
      run: (v) => {
        if (!v.text) throw new Error('Empty input.');
        const lines: string[] = [];
        for (const ch of [...v.text]) {
          const cp = ch.codePointAt(0)!;
          if (ch.length === 2) {
            const hi = ch.charCodeAt(0), lo = ch.charCodeAt(1);
            lines.push(`${ch}  U+${cp.toString(16).toUpperCase()}`);
            lines.push(`   high surrogate: 0x${hi.toString(16).toUpperCase().padStart(4, '0')} (U+D800–DBFF ✔)`);
            lines.push(`   low surrogate:  0x${lo.toString(16).toUpperCase().padStart(4, '0')} (U+DC00–DFFF ✔)`);
            lines.push(`   recombines as: 0x10000 + ((${hi.toString(16).toUpperCase()}−D800)≪10) + (${lo.toString(16).toUpperCase()}−DC00)`);
          } else {
            lines.push(`${ch}  U+${cp.toString(16).toUpperCase().padStart(4, '0')} — single code unit (BMP, no pair needed)`);
          }
        }
        const astral = [...v.text].filter((c) => c.length === 2).length;
        lines.push('');
        lines.push(`${[...v.text].length} character${[...v.text].length === 1 ? '' : 's'}, ${astral} outside the Basic Multilingual Plane.`);
        return textValue(lines.join('\n'));
      }
    }
  ],
  examples: [{ label: 'Mix', input: 'a汉🙂' }]
});
