// Compression — second wave: classic teaching algorithms implemented genuinely
// (RLE, LZW, LZ77, Huffman) plus measurement and comparison utilities.
// Entries clearly identify their wire format; none pretends to beat DEFLATE.
import { defineOp } from './core/registry';
import { textValue, bytesValue } from './core/types';
import { utf8, hexToBytes } from '../utils/bytes';

type CompressionFormatName = 'gzip' | 'deflate';

async function gzipBytes(data: Uint8Array, fmt: CompressionFormatName = 'gzip'): Promise<Uint8Array> {
  const cs = new CompressionStream(fmt);
  const w = cs.writable.getWriter();
  void w.write(data as Uint8Array<ArrayBuffer>).then(() => w.close());
  const r = cs.readable.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await r.read();
    if (done) break;
    chunks.push(value);
  }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

/* ----------------------------------- RLE ----------------------------------- */

defineOp({
  id: 'rle',
  name: 'Run-Length Encoding',
  category: 'compression',
  description: 'The simplest compression: AAAAABBBCC → 5A 3B 2C. Shines on runs, honest output format (count + byte).',
  aliases: ['run length', 'rle compression'],
  tags: ['compression', 'rle', 'classic'],
  input: 'any',
  output: 'bytes',
  reversible: true,
  engine: 'typescript',
  options: [
    { type: 'toggle', key: 'hexInput', label: 'Input is hexadecimal bytes', default: false },
    { type: 'toggle', key: 'readable', label: 'Readable output (5A 3B) instead of binary', default: true }
  ],
  actions: [
    {
      id: 'compress', label: 'Compress', kind: 'compress',
      run: (v, o) => {
        const data = o.hexInput ? hexToBytes(v.text) : utf8.encode(v.text);
        if (!data.length) throw new Error('Empty input.');
        const runs: [number, number][] = [];
        let cur = data[0], n = 1;
        for (let i = 1; i <= data.length; i++) {
          if (i < data.length && data[i] === cur && n < 255) n++;
          else { runs.push([n, cur]); cur = data[i]; n = 1; }
        }
        if (o.readable) {
          const body = runs.map(([count, b]) => `${count}${b >= 32 && b <= 126 ? String.fromCharCode(b) : 'x' + b.toString(16).padStart(2, '0')}`).join(' ');
          return textValue(`${body}\n\n— ${data.length} → ${runs.length * 2} bytes (binary form)`);
        }
        const bin = new Uint8Array(runs.length * 2);
        runs.forEach(([c, b], i) => { bin[i * 2] = c; bin[i * 2 + 1] = b; });
        return bytesValue(bin);
      }
    },
    {
      id: 'decompress', label: 'Decompress (binary)', kind: 'decompress',
      run: (v) => {
        const t = v.text.trim();
        const data = /^((?:[0-9a-fA-F]{2})[\s:]*)+$/.test(t) ? hexToBytes(t) : (v.bytes ?? hexToBytes(t));
        if (data.length % 2) throw new Error('Binary RLE is (count,byte) pairs — an even byte count is required.');
        const out = new Uint8Array(Array.from({ length: data.length / 2 }, (_, i) => data[i * 2]).reduce((n, c) => n + c, 0));
        let p = 0;
        for (let i = 0; i < data.length; i += 2) out.fill(data[i + 1], p, (p += data[i]));
        try { return textValue(utf8.decodeStrict(out)); } catch { return bytesValue(out); }
      }
    }
  ],
  examples: [{ label: 'Runs', input: 'AAAAAABBBCCDDDDDDDDDDDD' }],
  docs: 'Worst-case input (no runs at all) DOUBLES in size — that trade-off is exactly why RLE is taught first.'
});

/* ----------------------------------- LZW ----------------------------------- */

defineOp({
  id: 'lzw',
  name: 'LZW Compression',
  category: 'compression',
  description: 'Dictionary-based compressor (GIF/TIFF family). Output rendered as a code list; decode consumes that exact list.',
  aliases: ['lempel ziv welch', 'gif compression'],
  tags: ['compression', 'lzw', 'dictionary', 'classic'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  options: [{ type: 'toggle', key: 'showDictionary', label: 'Show dictionary grows (first 12 entries)', default: false }],
  actions: [
    {
      id: 'compress', label: 'Compress', kind: 'compress',
      run: (v, o) => {
        const text = v.text;
        if (!text) throw new Error('Empty input.');
        const dict = new Map<string, number>();
        let next = 256;
        const added: string[] = [];
        let w = '';
        const codes: number[] = [];
        for (const ch of text) {
          const wc = w + ch;
          if (dict.has(wc) || wc.length === 1) w = wc;
          else {
            codes.push(w.length === 1 ? w.charCodeAt(0) : dict.get(w)!);
            dict.set(wc, next);
            if (added.length < 12 && next < 268) added.push(`"${wc}" → ${next}`);
            next++;
            if (next > 65535) throw new Error('Dictionary exhausted the 16-bit demonstration range.');
            w = ch;
          }
        }
        if (w) codes.push(w.length ===  1 ? w.charCodeAt(0) : dict.get(w)!);
        const ratio = ((1 - (codes.length * 2) / utf8.encode(text).length) * 100).toFixed(1);
        let out = 'CODES ' + codes.join(' ');
        out += `\n\n— ${codes.length} codes (≤16-bit) for ${utf8.encode(text).length} input bytes (${ratio}% smaller as packed codes)`;
        if (o.showDictionary && added.length) out += `\n\nDictionary, first entries:\n${added.join('\n')}`;
        return textValue(out, 'encoded');
      }
    },
    {
      id: 'decompress', label: 'Decompress', kind: 'decompress',
      run: (v) => {
        const marked = v.text.match(/CODES\s+([0-9 ]+)/);
        const raw = marked ? marked[1] : v.text;
        const toks = raw.trim().split(/\s+/).map(Number);
        if (toks.some((t) => !Number.isInteger(t) || t < 0 || t > 65535)) throw new Error('LZW input must be space-separated codes 0–65535.');
        const dict: string[] = new Array(65536);
        for (let i = 0; i < 256; i++) dict[i] = String.fromCharCode(i);
        let next = 256;
        let prev = dict[toks[0]];
        if (!prev) throw new Error('First code is out of range.');
        let out = prev;
        for (let i = 1; i < toks.length; i++) {
          const code = toks[i];
          let entry: string;
          if (dict[code]) entry = dict[code];
          else if (code === next) entry = prev + prev[0];
          else throw new Error(`Bad LZW code ${code} at position ${i}.`);
          out += entry;
          dict[next++] = prev + entry[0];
          prev = entry;
        }
        return textValue(out);
      }
    }
  ],
  examples: [{ label: 'Classic', input: 'TOBEORNOTTOBEORTOBEORNOT', options: { showDictionary: true } }],
  docs: 'The decoder rebuilds the same dictionary — including the famous KwKwK edge case (code == next index).'
});

/* ------------------------------- LZ77 demo ----------------------------------- */

defineOp({
  id: 'lz77',
  name: 'LZ77 Demonstration',
  category: 'compression',
  description: 'Tokenizes input into (offset, length, next-char) triples exactly like the 1977 paper — visible, educational, and genuinely round-trippable.',
  aliases: ['lzss', 'sliding window', 'lempel ziv 77'],
  tags: ['compression', 'lz77', 'dictionary', 'classic'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  options: [{ type: 'number', key: 'window', label: 'Window size', default: 255, min: 8, max: 4096 }],
  actions: [
    {
      id: 'compress', label: 'Tokenize', kind: 'compress',
      run: (v, o) => {
        const s = v.text;
        const window = Number(o.window ?? 255);
        const toks: string[] = [];
        let i = 0;
        while (i < s.length) {
          let bestLen = 0, bestOff = 0;
          const start = Math.max(0, i - window);
          for (let j = start; j < i; j++) {
            let len = 0;
            while (i + len < s.length && s[j + len] === s[i + len] && len < 255) len++;
            if (len > bestLen) { bestLen = len; bestOff = i - j; }
          }
          if (bestLen >= 3) {
            toks.push(`(${bestOff},${bestLen},${JSON.stringify(s[i + bestLen] ?? '') || '""'})`);
            i += bestLen + (i + bestLen < s.length ? 1 : 0);
          } else {
            toks.push(`(0,0,${JSON.stringify(s[i])})`);
            i++;
          }
        }
        const litChars = s.length;
        const saved = litChars - toks.length;
        return textValue(`${toks.join('\n')}\n\n— ${toks.length} triples (${saved > 0 ? saved + ' character positions saved before storage overhead' : 'no matches — pure literals'})`);
      }
    },
    {
      id: 'decompress', label: 'Rebuild', kind: 'decompress',
      run: (v) => {
        const re = /^\((\d+),(\d+),("(?:[^"\\]|\\.)*")\)$/gm;
        let out = '';
        let m: RegExpExecArray | null;
        let count = 0;
        while ((m = re.exec(v.text)) !== null) {
          const off = Number(m[1]), len = Number(m[2]);
          const ch = JSON.parse(m[3]) as string;
          for (let k = 0; k < len; k++) {
            if (off > out.length) throw new Error('Offset points before the start of the rebuilt text.');
            out += out[out.length - off];
          }
          out += ch;
          count++;
        }
        if (count === 0) throw new Error('No (offset,length,"char") triples found.');
        return textValue(out);
      }
    }
  ],
  examples: [{ label: 'Repeated', input: 'abracadabra abracadabra' }],
  docs: 'A proper LZSS bitstream would pack these triples — the demo keeps them readable so the sliding window is visible.'
});

/* --------------------------------- huffman ---------------------------------- */

interface HNode { freq: number; ch?: string; l?: HNode; r?: HNode }

function buildHuffman(text: string): { root: HNode; table: Map<string, string> } {
  const freq = new Map<string, number>();
  for (const ch of text) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  const heap: HNode[] = [...freq.entries()].map(([ch, f]) => ({ ch, freq: f })).sort((a, b) => a.freq - b.freq);
  if (heap.length === 1) heap.push({ ch: heap[0].ch === '0' ? '1' : '0', freq: 0 });
  while (heap.length > 1) {
    const a = heap.shift()!, b = heap.shift()!;
    const node: HNode = { freq: a.freq + b.freq, l: a, r: b };
    let i = 0;
    while (i < heap.length && heap[i].freq <= node.freq) i++;
    heap.splice(i, 0, node);
  }
  const root = heap[0];
  const table = new Map<string, string>();
  const walk = (n: HNode, path: string) => {
    if (n.ch !== undefined) { table.set(n.ch, path || '0'); return; }
    walk(n.l!, path + '0');
    walk(n.r!, path + '1');
  };
  walk(root, '');
  return { root, table };
}

// Tree serialization with explicit length prefix per leaf: L<hexlen>:<hex> | N<left><right>
function serTree(n: HNode): string {
  if (n.ch !== undefined) {
    const hex = [...utf8.encode(n.ch)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `L${hex.length}:${hex}`;
  }
  return `N${serTree(n.l!)}${serTree(n.r!)}`;
}

function deTree(s: string, p: number): [HNode, number] {
  if (s[p] === 'N') {
    const [l, p2] = deTree(s, p + 1);
    const [r, p3] = deTree(s, p2);
    return [{ freq: l.freq + r.freq, l, r }, p3];
  }
  if (s[p] === 'L') {
    const colon = s.indexOf(':', p);
    const len = Number(s.slice(p + 1, colon));
    const hex = s.slice(colon + 1, colon + 1 + len);
    const bytes = new Uint8Array(hex.match(/../g)!.map((h) => parseInt(h, 16)));
    return [{ freq: 0, ch: utf8.decodeStrict(bytes) }, colon + 1 + len];
  }
  throw new Error('Corrupt Huffman tree header.');
}

defineOp({
  id: 'huffman',
  name: 'Huffman Coding',
  category: 'compression',
  description: 'Optimal prefix coding from symbol frequencies (1952). Output = tree header + bitstream; decode reverses with the embedded tree.',
  aliases: ['huffman tree', 'prefix code', 'shannon fano?'],
  tags: ['compression', 'entropy', 'classic'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    {
      id: 'compress', label: 'Compress', kind: 'compress',
      run: (v) => {
        const text = v.text;
        if (!text) throw new Error('Empty input.');
        const { root, table } = buildHuffman(text);
        const bits = [...text].map((ch) => table.get(ch)!).join('');
        const header = serTree(root);
        const byteCount = Math.ceil(bits.length / 8);
        const inBytes = utf8.encode(text).length;
        const sample = bits.length > 200 ? bits.slice(0, 200) + '…' : bits;
        const lines = [
          `TREE ${header}`,
          `BITS ${sample}`,
          '',
          `— ${inBytes} bytes in → ${byteCount}-byte payload + ${header.length}-char tree header.`,
          `— ${bits.length} bits for ${[...text].length} chars = ${(bits.length / [...text].length).toFixed(2)} bits/char (ASCII would need 8).`
        ];
        const freqs = [...table.entries()].sort((a, b) => a[1].length - b[1].length).slice(0, 8);
        lines.push('', 'Shortest codes (most frequent symbols):');
        freqs.forEach(([ch, code]) => lines.push(`  ${JSON.stringify(ch)}  ${code}`));
        // stash true bitstream after marker for decode
        lines.push('', `PAYLOAD ${bits}`);
        return textValue(lines.join('\n'), 'encoded');
      }
    },
    {
      id: 'decompress', label: 'Decompress', kind: 'decompress',
      run: (v) => {
        const treeLine = v.text.match(/TREE (\S+)/);
        const payload = v.text.match(/PAYLOAD ([01]+)/);
        if (!treeLine || !payload) throw new Error('Expected the full output of "Compress" (TREE line and PAYLOAD line).');
        const [root, consumed] = deTree(treeLine[1], 0);
        if (consumed !== treeLine[1].length) throw new Error('Tree header has trailing garbage.');
        let out = '';
        let node = root;
        for (const bit of payload[1]) {
          node = bit === '0' ? node.l! : node.r!;
          if (node.ch !== undefined) { out += node.ch; node = root; }
        }
        if (node !== root) throw new Error('Bitstream ends mid-code — input may be truncated.');
        return textValue(out);
      }
    }
  ],
  examples: [{ label: 'Entropy demo', input: 'this is an example of a huffman tree' }],
  docs: 'The header embeds the tree, so the payload is fully self-contained — at small sizes the header dominates, exactly like real-world Huffman.'
});

/* --------------------------- measurement utilities -------------------------- */

defineOp({
  id: 'compression-ratio',
  name: 'Compression Ratio Calculator',
  category: 'compression',
  description: 'Paste the original and compressed sizes (and optionally the data) — get ratio, space saving, and bits/char.',
  aliases: ['ratio calc', 'space saving'],
  tags: ['compression', 'analysis', 'calculator'],
  input: 'text',
  output: 'text',
  reversible: false,
  engine: 'typescript',
  options: [
    { type: 'number', key: 'originalSize', label: 'Original size (bytes; 0 = measure input)', default: 0, min: 0 },
    { type: 'number', key: 'compressedSize', label: 'Compressed size (bytes; 0 = gzip the input)', default: 0, min: 0 }
  ],
  actions: [
    {
      id: 'analyze', label: 'Calculate', kind: 'analyze',
      run: async (v, o) => {
        const orig = Number(o.originalSize) > 0 ? Number(o.originalSize) : utf8.encode(v.text).length;
        let comp = Number(o.compressedSize);
        let note = '';
        if (comp <= 0) {
          const gz = await gzipBytes(utf8.encode(v.text));
          comp = gz.length;
          note = ` (measured: gzip actually produced ${comp} bytes)`;
        }
        if (orig <= 0) throw new Error('Original size is zero — provide input or sizes.');
        const ratio = orig / comp;
        const saving = 100 * (1 - comp / orig);
        return textValue(
          `Original:   ${orig} bytes\nCompressed: ${comp} bytes${note}\n\nRatio:        ${ratio.toFixed(3)} : 1\nSpace saving: ${saving.toFixed(1)}%\nBits/byte of compression: ${(8 / ratio).toFixed(2)} bits/output-byte`
        );
      }
    }
  ],
  examples: [{ label: 'Measure real gzip', input: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa text text text text' }]
});

defineOp({
  id: 'compression-compare',
  name: 'Compression Size Comparison',
  category: 'compression',
  description: 'Runs the input through gzip, zlib, Huffman and RLE and ranks them — a live demo that algorithms have different habitats.',
  aliases: ['compare compressors', 'which compression is best'],
  tags: ['compression', 'analysis', 'comparison'],
  input: 'text',
  output: 'text',
  reversible: false,
  engine: 'browser',
  actions: [
    {
      id: 'analyze', label: 'Compare', kind: 'analyze',
      run: async (v) => {
        const data = utf8.encode(v.text);
        if (!data.length) throw new Error('Empty input.');
        const rows: [string, number, string][] = [[String(data.length) + ' (raw)', data.length, 'uncompressed']];
        try { rows.push(['gzip', (await gzipBytes(data, 'gzip')).length, 'system']); } catch { /* ignore */ }
        try { rows.push(['zlib', (await gzipBytes(data, 'deflate')).length, 'system']); } catch { /* ignore */ }
        // huffman payload bits
        const { root, table } = buildHuffman(v.text);
        const bits = [...v.text].reduce((n, ch) => n + table.get(ch)!.length, 0);
        rows.push(['huffman (payload only)', Math.ceil(bits / 8), `tree header ${serTree(root).length} chars extra`]);
        // RLE binary
        let runs = 1;
        for (let i = 1; i < data.length; i++) if (data[i] !== data[i - 1]) runs++;
        rows.push(['RLE (binary pairs)', runs * 2, '']);
        rows.sort((a, b) => a[1] - b[1]);
        const lines = [`Input: ${data.length} bytes`, ''];
        rows.forEach(([name, size, note], i) => {
          const pct = ((1 - size / data.length) * 100).toFixed(1);
          lines.push(`${i + 1}. ${name.padEnd(26)} ${String(size).padStart(6)} B   ${pct.padStart(6)}%${note ? '   — ' + note : ''}`);
        });
        lines.push('', 'Huffman\'s tree header makes it lose on short/flat text; RLE loses unless data has runs. DEFLATE wins generally because it combines LZ77 AND Huffman.');
        return textValue(lines.join('\n'));
      }
    }
  ],
  examples: [{ label: 'Mixed text', input: 'the rain in spain stays mainly in the plain. the rain in spain.' }],
  warnings: ['Slower on very large inputs (Huffman is O(n log k) in-memory; gzip runs in-browser natively).']
});

defineOp({
  id: 'packing-compare',
  name: 'Binary-to-Text Packing Comparison',
  category: 'compression',
  description: 'Same bytes through hex, Base64, Base32, Ascii85 and basE91 — a live overhead table for byte-to-text formats.',
  aliases: ['encoding overhead', 'binary to text compare'],
  tags: ['encoding', 'compression', 'comparison'],
  input: 'any',
  output: 'text',
  reversible: false,
  engine: 'typescript',
  options: [{ type: 'toggle', key: 'hexInput', label: 'Input is hexadecimal bytes', default: false }],
  actions: [
    {
      id: 'analyze', label: 'Compare', kind: 'analyze',
      run: (v, o) => {
        const data = o.hexInput ? hexToBytes(v.text) : utf8.encode(v.text);
        if (!data.length) throw new Error('Empty input.');
        const hexLen = data.length * 2;
        const b64Len = Math.ceil(data.length / 3) * 4;
        const b32Len = Math.ceil(data.length / 5) * 8;
        const b85Len = Math.ceil(data.length / 4) * 5;
        const rows: [string, number][] = [
          ['Hex (Base16)', hexLen],
          ['Base64', b64Len],
          ['Base64URL', b64Len],
          ['Base32', b32Len],
          ['Ascii85 (+~4% worst break)', b85Len],
          ['basE91 (theoretical ~1.23×)', Math.ceil(data.length * 1.23)]
        ];
        rows.sort((a, b) => a[1] - b[1]);
        const lines = [`Input: ${data.length} bytes`, ''];
        rows.forEach(([name, len], i) => lines.push(`${(i + 1) + '. '}${name.padEnd(32)} ${len} chars   (+${(((len - data.length) / data.length) * 100).toFixed(0)}%)`));
        lines.push('', 'Denser alphabets waste fewer bits per character — the whole story of the Base-N family in one table.');
        return textValue(lines.join('\n'));
      }
    }
  ]
});
