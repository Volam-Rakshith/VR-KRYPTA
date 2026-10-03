// Compression via the browser-native Compression Streams API.
// Input: text (UTF-8) or hex bytes. Output: bytes (hex view) / back to text.
import { defineOp } from './core/registry';
import { textValue, bytesValue } from './core/types';
import { utf8, hexToBytes } from '../utils/bytes';

type CompressionFormatName = 'gzip' | 'deflate' | 'deflate-raw';

async function streamTransform(data: Uint8Array, kind: 'compress' | 'decompress', format: CompressionFormatName): Promise<Uint8Array> {
  const Ctor = kind === 'compress'
    ? (globalThis as { CompressionStream?: new (f: CompressionFormatName) => TransformStream<Uint8Array, Uint8Array> }).CompressionStream
    : (globalThis as { DecompressionStream?: new (f: CompressionFormatName) => TransformStream<Uint8Array, Uint8Array> }).DecompressionStream;
  if (!Ctor) throw new Error(`${kind === 'compress' ? 'Compression' : 'Decompression'}Stream is not available in this browser. Try a current Chromium/Firefox/Safari release.`);
  const stream = new Ctor(format);
  const writer = stream.writable.getWriter();
  void writer.write(data).then(() => writer.close());
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

function compressionOp(cfg: { id: string; name: string; format: CompressionFormatName; desc: string; aliases?: string[] }) {
  defineOp({
    id: cfg.id,
    name: cfg.name,
    category: 'compression',
    description: cfg.desc,
    aliases: cfg.aliases,
    tags: ['compression', 'bytes', 'stream'],
    input: 'any',
    output: 'bytes',
    reversible: true,
    engine: 'browser',
    options: [
      { type: 'toggle', key: 'hexInput', label: 'Input is hexadecimal bytes', default: false },
      { type: 'toggle', key: 'showRatio', label: 'Show size report', default: true }
    ],
    actions: [
      {
        id: 'compress', label: 'Compress', kind: 'compress',
        run: async (v, o) => {
          const data = o.hexInput ? hexToBytes(v.text) : (v.bytes ?? utf8.encode(v.text));
          const out = await streamTransform(data, 'compress', cfg.format);
          const ratio = o.showRatio
            ? `\n\n— ${data.length} → ${out.length} bytes (${data.length ? ((1 - out.length / data.length) * 100).toFixed(1) : 0}% smaller)`
            : '';
          const val = bytesValue(out);
          return { ...val, text: val.text + ratio };
        }
      },
      {
        id: 'decompress', label: 'Decompress', kind: 'decompress',
        run: async (v) => {
          const data = v.bytes ?? hexToBytes(v.text);
          let out: Uint8Array;
          try {
            out = await streamTransform(data, 'decompress', cfg.format);
          } catch {
            throw new Error(`Decompression failed — the input does not look like a valid ${cfg.name} stream. Check the format toggle and that no bytes were lost in copy/paste.`);
          }
          try {
            return textValue(utf8.decodeStrict(out));
          } catch {
            return bytesValue(out);
          }
        }
      }
    ],
    docs: `${cfg.name} streams are produced with the browser's native Compression Streams API. Decompress expects ${cfg.format === 'gzip' ? 'a gzip member (starts 1f 8b)' : cfg.format === 'deflate' ? 'a zlib-wrapped stream (starts 78 …)' : 'a raw DEFLATE stream (no zlib header)'} as hexadecimal bytes.`,
    warnings: ['Very large or pathological inputs can expand dramatically when decompressed — resource limits of your browser apply.']
  });
}

compressionOp({
  id: 'gzip', name: 'gzip', format: 'gzip',
  desc: 'The ubiquitous .gz stream format (DEFLATE + headers + CRC32), compressed and decompressed natively in your browser.',
  aliases: ['gz', 'gunzip']
});
compressionOp({
  id: 'zlib', name: 'zlib (DEFLATE)', format: 'deflate',
  desc: 'Zlib-wrapped DEFLATE stream (RFC 1950) — what Python\'s zlib.compress() produces.',
  aliases: ['deflate', 'zlib compress']
});
compressionOp({
  id: 'deflate-raw', name: 'DEFLATE (raw)', format: 'deflate-raw',
  desc: 'Raw DEFLATE bitstream without the zlib wrapper (RFC 1951) — used inside ZIP and gzip bodies.',
  aliases: ['raw deflate', 'inflate']
});
