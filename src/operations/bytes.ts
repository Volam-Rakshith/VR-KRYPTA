// Byte-level operations. Input kind 'bytes' accepts hexadecimal text in the
// workspace; outputs of kind 'bytes' render as hex with a byte count.
import { defineOp } from './core/registry';
import { textValue, bytesValue } from './core/types';
import { utf8, hexToBytes, bytesToHex } from '../utils/bytes';

function inputBytes(v: { text: string; bytes?: Uint8Array }): Uint8Array {
  if (v.bytes) return v.bytes;
  return utf8.encode(v.text);
}

function xorBytes(data: Uint8Array, key: Uint8Array): Uint8Array {
  if (!key.length) throw new Error('XOR key must not be empty.');
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i] ^ key[i % key.length];
  return out;
}

defineOp({
  id: 'text-to-bytes',
  name: 'Text → Bytes (UTF-8)',
  category: 'bytes',
  description: 'Explicit bridge: encode text into its UTF-8 byte sequence. Pipeline steps that need bytes can connect after this.',
  aliases: ['encode utf8', 'string to bytes', 'utf8 encode'],
  tags: ['bytes', 'utf-8', 'convert'],
  input: 'text',
  output: 'bytes',
  reversible: true,
  engine: 'typescript',
  actions: [
    {
      id: 'convert', label: 'To bytes', kind: 'convert',
      run: (v) => bytesValue(v.bytes ?? utf8.encode(v.text))
    },
    {
      id: 'back', label: 'Back to text', kind: 'convert',
      run: (v) => textValue(utf8.decodeStrict(inputBytes(v)))
    }
  ],
  examples: [{ label: 'Multi-byte', input: 'KRYPTΛ €' }],
  docs: 'Characters outside ASCII occupy 2–4 bytes each under UTF-8 — the byte count will exceed the character count.'
});

defineOp({
  id: 'xor-cipher',
  name: 'XOR Transformation',
  category: 'bytes',
  description: 'Bitwise XOR of data against a repeating key (text or hex). Applying it twice with the same key restores the input.',
  aliases: ['xor cipher', 'xor encrypt', 'one time pad', 'xor bytes'],
  tags: ['bytes', 'xor', 'bitwise', 'crypto'],
  input: 'any',
  output: 'bytes',
  reversible: true,
  engine: 'typescript',
  options: [
    { type: 'text', key: 'key', label: 'Key', default: 'KRYPTA', help: 'Plain text, or hex when the toggle below is on.' },
    { type: 'toggle', key: 'hexKey', label: 'Key is hexadecimal', default: false },
    { type: 'toggle', key: 'hexInput', label: 'Input is hexadecimal bytes', default: false }
  ],
  actions: [
    {
      id: 'apply', label: 'Apply XOR', kind: 'transform',
      run: (v, o) => {
        const key = o.hexKey ? hexToBytes(String(o.key ?? '')) : utf8.encode(String(o.key ?? ''));
        const data = o.hexInput ? hexToBytes(v.text) : inputBytes(v);
        return bytesValue(xorBytes(data, key));
      }
    }
  ],
  examples: [{ label: 'XOR with KRYPTA', input: 'Attack at dawn' }],
  docs: 'XOR against a key is reversible only if you keep the key. A repeating short key is trivially broken — only a true one-time pad is secure, and only if never reused.',
  warnings: ['A repeating-key XOR is not secure encryption.']
});

defineOp({
  id: 'bitwise-not',
  name: 'Bitwise NOT',
  category: 'bytes',
  description: 'Inverts every bit of the input (one\'s complement). Self-inverse.',
  aliases: ['invert bits', 'complement', 'not bytes'],
  tags: ['bytes', 'bitwise'],
  input: 'any',
  output: 'bytes',
  reversible: true,
  engine: 'typescript',
  options: [{ type: 'toggle', key: 'hexInput', label: 'Input is hexadecimal bytes', default: false }],
  actions: [
    {
      id: 'apply', label: 'Apply NOT', kind: 'transform',
      run: (v, o) => {
        const data = o.hexInput ? hexToBytes(v.text) : inputBytes(v);
        return bytesValue(Uint8Array.from(data, (b) => ~b & 0xff));
      }
    }
  ]
});

defineOp({
  id: 'reverse-bytes',
  name: 'Reverse Byte Order',
  category: 'bytes',
  description: 'Reverse the order of bytes in the sequence (not the bits inside each byte). Self-inverse.',
  aliases: ['byte reversal', 'reverse bytes'],
  tags: ['bytes', 'order'],
  input: 'any',
  output: 'bytes',
  reversible: true,
  engine: 'typescript',
  options: [{ type: 'toggle', key: 'hexInput', label: 'Input is hexadecimal bytes', default: false }],
  actions: [
    {
      id: 'apply', label: 'Reverse', kind: 'transform',
      run: (v, o) => {
        const data = o.hexInput ? hexToBytes(v.text) : inputBytes(v);
        return bytesValue(Uint8Array.from(data).reverse());
      }
    }
  ]
});

defineOp({
  id: 'endian-conversion',
  name: 'Endianness Conversion',
  category: 'bytes',
  description: 'Swap between little-endian and big-endian by reversing bytes within fixed-size words.',
  aliases: ['byte swap', 'little endian', 'big endian', 'swap endian'],
  tags: ['bytes', 'endian', 'order'],
  input: 'any',
  output: 'bytes',
  reversible: true,
  engine: 'typescript',
  options: [
    { type: 'select', key: 'wordSize', label: 'Word size', default: '4', options: [
      { value: '2', label: '2 bytes (16-bit)' },
      { value: '4', label: '4 bytes (32-bit)' },
      { value: '8', label: '8 bytes (64-bit)' }
    ] },
    { type: 'toggle', key: 'hexInput', label: 'Input is hexadecimal bytes', default: true }
  ],
  actions: [
    {
      id: 'swap', label: 'Swap endianness', kind: 'transform',
      run: (v, o) => {
        const data = o.hexInput ? hexToBytes(v.text) : inputBytes(v);
        const w = Number(o.wordSize ?? 4);
        if (data.length % w !== 0) throw new Error(`${data.length} bytes is not a multiple of the ${w}-byte word size.`);
        const out = new Uint8Array(data.length);
        for (let i = 0; i < data.length; i += w) for (let k = 0; k < w; k++) out[i + k] = data[i + w - 1 - k];
        return bytesValue(out);
      }
    }
  ],
  examples: [{ label: '32-bit words', input: '01 02 03 04 05 06 07 08', options: { hexInput: true, wordSize: '4' } }]
});

defineOp({
  id: 'hexdump',
  name: 'Hex Dump Inspector',
  category: 'bytes',
  description: 'Classic hexdump view: offsets, 16 bytes per row, and the printable-ASCII gutter.',
  aliases: ['hex dump', 'xxd', 'hex viewer', 'inspect bytes'],
  tags: ['bytes', 'analysis', 'hex'],
  input: 'any',
  output: 'text',
  reversible: false,
  engine: 'typescript',
  options: [{ type: 'toggle', key: 'hexInput', label: 'Input is hexadecimal bytes', default: false }],
  actions: [
    {
      id: 'analyze', label: 'Inspect', kind: 'analyze',
      run: (v, o) => {
        const data = o.hexInput ? hexToBytes(v.text) : inputBytes(v);
        const lines: string[] = [];
        for (let i = 0; i < data.length; i += 16) {
          const slice = data.slice(i, i + 16);
          const hex = Array.from(slice, (b) => b.toString(16).padStart(2, '0')).join(' ').padEnd(47, ' ');
          const ascii = Array.from(slice, (b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.')).join('');
          lines.push(`${i.toString(16).padStart(8, '0')}  ${hex}  |${ascii}|`);
        }
        lines.push(`— ${data.length} byte${data.length === 1 ? '' : 's'} total`);
        return textValue(lines.join('\n') || '(empty input)');
      }
    }
  ],
  examples: [{ label: 'Hello bytes', input: 'Hello, KRYPTA!' }]
});

defineOp({
  id: 'bit-rotate',
  name: 'Bit Rotate',
  category: 'bytes',
  description: 'Rotate each byte\'s bits left or right by N positions (circular shift).',
  aliases: ['rotate bits', 'ror', 'rol', 'circular shift'],
  tags: ['bytes', 'bitwise'],
  input: 'any',
  output: 'bytes',
  reversible: true,
  engine: 'typescript',
  options: [
    { type: 'number', key: 'amount', label: 'Rotate amount', default: 1, min: 1, max: 7 },
    { type: 'select', key: 'direction', label: 'Direction', default: 'left', options: [
      { value: 'left', label: 'Left (ROL)' },
      { value: 'right', label: 'Right (ROR)' }
    ] },
    { type: 'toggle', key: 'hexInput', label: 'Input is hexadecimal bytes', default: false }
  ],
  actions: [
    {
      id: 'rotate', label: 'Rotate', kind: 'transform',
      run: (v, o) => {
        const data = o.hexInput ? hexToBytes(v.text) : inputBytes(v);
        const k = Number(o.amount ?? 1) % 8;
        const left = String(o.direction) === 'left';
        return bytesValue(Uint8Array.from(data, (b) => left ? ((b << k) | (b >>> (8 - k))) & 0xff : ((b >>> k) | (b << (8 - k))) & 0xff));
      }
    }
  ],
  docs: 'Rotate left by N undoes rotate right by N (and vice versa) — the pair is reversible.'
});

export { bytesToHex };
