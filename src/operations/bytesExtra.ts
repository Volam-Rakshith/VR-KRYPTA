// Bytes & Binary — second wave: two-input bitwise logic (operand B via an
// option field), shifts/rotates, integer representations, float inspectors,
// and variable-length integer formats (varint / zigzag / LEB128).
// Two-input ops take data on HEX bytes so "operand B" is also hex — documented.
import { defineOp } from './core/registry';
import { textValue, bytesValue } from './core/types';
import { utf8, hexToBytes, bytesToHex } from '../utils/bytes';

function needHex(v: { text: string }): Uint8Array {
  const b = hexToBytes(v.text);
  if (!b.length) throw new Error('Empty input.');
  return b;
}

function binaryLogic(id: string, name: string, desc: string, fn: (a: number, b: number) => number) {
  defineOp({
    id,
    name,
    category: 'bytes',
    description: desc,
    aliases: [name.toLowerCase()],
    tags: ['bytes', 'bitwise', 'logic'],
    input: 'text',
    output: 'bytes',
    reversible: false,
    engine: 'typescript',
    options: [{ type: 'text', key: 'operandB', label: 'Operand B (hex; cycled if shorter)', default: 'ff' }],
    actions: [{
      id: 'apply', label: 'Apply', kind: 'convert',
      run: (v, o) => {
        const a = needHex(v);
        const bH = String(o.operandB ?? 'ff').trim();
        const b = hexToBytes(bH);
        if (!b.length) throw new Error('Operand B is empty.');
        const out = new Uint8Array(a.length);
        for (let i = 0; i < a.length; i++) out[i] = fn(a[i], b[i % b.length]) & 255;
        return bytesValue(out);
      }
    }],
    examples: [{ label: 'Byte demo', input: 'f0 a5 3c', options: { operandB: 'aa' } }],
    docs: 'Both operands are hex bytes. If B is shorter than the input it repeats cyclically — a one-byte B (e.g. "AA", binary 10101010) therefore applies to every byte.'
  });
}

binaryLogic('bitwise-and', 'Bitwise AND', 'Per-byte AND against a second operand (both as hex bytes). Set a mask in B to keep only chosen bits.', (a, b) => a & b);
binaryLogic('bitwise-or', 'Bitwise OR', 'Per-byte OR against a second operand (both as hex bytes). B acts as a "set these bits" mask.', (a, b) => a | b);
binaryLogic('bitwise-xor', 'Bitwise XOR', 'Per-byte XOR against a second operand (both as hex bytes). XOR is its own inverse — same op decrypts.', (a, b) => a ^ b);
binaryLogic('bitwise-nand', 'Bitwise NAND', 'Per-byte NOT(AND): the universal logic gate, at byte granularity.', (a, b) => ~(a & b));
binaryLogic('bitwise-nor', 'Bitwise NOR', 'Per-byte NOT(OR) — set only where both operands are zero.', (a, b) => ~(a | b));
binaryLogic('bitwise-xnor', 'Bitwise XNOR', 'Per-byte equivalence — output bit = 1 where A and B agree.', (a, b) => ~(a ^ b));

/*  Note: per-byte bitwise NOT already ships in bytes.ts; the ops below add
    everything Phase 1 did not cover. */

/* ------------------------------- shifts/rotates ----------------------------- */

defineOp({
  id: 'bit-shift',
  name: 'Bit Shift (whole stream)',
  category: 'bytes',
  description: 'Treats the whole input as one big bit string and shifts left/right, filling with zeros.',
  aliases: ['shl', 'shr', 'left shift', 'right shift'],
  tags: ['bytes', 'bitwise', 'shift'],
  input: 'text',
  output: 'bytes',
  reversible: false,
  engine: 'typescript',
  options: [
    { type: 'select', key: 'dir', label: 'Direction', default: 'left', options: [{ value: 'left', label: 'Left (×2ⁿ)' }, { value: 'right', label: 'Right (÷2ⁿ)' }] },
    { type: 'number', key: 'bits', label: 'Positions', default: 1, min: 0, max: 64 }
  ],
  actions: [
    {
      id: 'apply', label: 'Shift', kind: 'convert',
      run: (v, o) => {
        const data = needHex(v);
        const n = Number(o.bits ?? 1) % (data.length * 8 || 8);
        const bits = [...data].flatMap((b) => Array.from({ length: 8 }, (_, i) => (b >> (7 - i)) & 1));
        const shifted = o.dir === 'right'
          ? [...Array(n).fill(0), ...bits.slice(0, bits.length - n)]
          : [...bits.slice(n), ...Array(n).fill(0)];
        const out = new Uint8Array(data.length);
        for (let i = 0; i < bits.length; i += 8) {
          let b = 0;
          for (let k = 0; k < 8; k++) b = (b << 1) | (shifted[i + k] ?? 0);
          out[i / 8] = b;
        }
        return bytesValue(out);
      }
    }
  ],
  examples: [{ label: 'One left', input: '11 22 44', options: { bits: 1 } }]
});

defineOp({
  id: 'bit-rotate-stream',
  name: 'Bit Rotate (whole stream)',
  category: 'bytes',
  description: 'Circular shift of the whole bit string — bits leaving one end re-enter at the other. Reversible by rotating back.',
  aliases: ['rol', 'ror', 'circular shift'],
  tags: ['bytes', 'bitwise', 'rotate'],
  input: 'text',
  output: 'bytes',
  reversible: true,
  engine: 'typescript',
  options: [
    { type: 'select', key: 'dir', label: 'Direction', default: 'left', options: [{ value: 'left', label: 'Rotate left' }, { value: 'right', label: 'Rotate right' }] },
    { type: 'number', key: 'bits', label: 'Positions', default: 1, min: 0, max: 64 }
  ],
  actions: [
    {
      id: 'left', label: 'Rotate', kind: 'convert',
      run: (v, o) => {
        const data = needHex(v);
        const total = data.length * 8;
        const n = ((Number(o.bits ?? 1) % total) + total) % total;
        const bits = [...data].flatMap((b) => Array.from({ length: 8 }, (_, i) => (b >> (7 - i)) & 1));
        const rot = o.dir === 'right'
          ? [...bits.slice(total - n), ...bits.slice(0, total - n)]
          : [...bits.slice(n), ...bits.slice(0, n)];
        const out = new Uint8Array(data.length);
        for (let i = 0; i < total; i += 8) {
          let b = 0;
          for (let k = 0; k < 8; k++) b = (b << 1) | rot[i + k];
          out[i / 8] = b;
        }
        return bytesValue(out);
      }
    }
  ],
  examples: [{ label: 'One around', input: '11 22 44', options: { bits: 1 } }]
});

defineOp({
  id: 'bit-reverse',
  name: 'Bit Order Reversal',
  category: 'bytes',
  description: 'Reverses the bit order inside every byte (MSB↔LSB) — the "FFT shuffle" op. Self-inverse.',
  aliases: ['mirror bits', 'reverse bits'],
  tags: ['bytes', 'bitwise'],
  input: 'text',
  output: 'bytes',
  reversible: true,
  engine: 'typescript',
  actions: [{
    id: 'apply', label: 'Reverse bits', kind: 'convert',
    run: (v) => bytesValue(needHex(v).map((b) => {
      let r = 0;
      for (let i = 0; i < 8; i++) r |= ((b >> i) & 1) << (7 - i);
      return r;
    }))
  }],
  examples: [{ label: 'Nibble mirror', input: 'b0 f0 01' }]
});

/* --------------------------- integer representations ------------------------ */

defineOp({
  id: 'signed-unsigned-view',
  name: 'Signed ↔ Unsigned Views',
  category: 'bytes',
  description: 'Same bytes read as unsigned, two\'s complement, sign-magnitude, and one\'s complement — across 8/16/32-bit widths.',
  aliases: ['twos complement', 'sign magnitude', 'signed bytes'],
  tags: ['bytes', 'integer', 'signedness'],
  input: 'text',
  output: 'text',
  reversible: false,
  engine: 'typescript',
  options: [{ type: 'select', key: 'width', label: 'Width per unit', default: '8', options: [{ value: '8', label: '8-bit' }, { value: '16', label: '16-bit' }, { value: '32', label: '32-bit' }] }],
  actions: [
    {
      id: 'analyze', label: 'Interpret', kind: 'analyze',
      run: (v, o) => {
        const data = needHex(v);
        const w = Number(o.width) / 8;
        if (data.length % w) throw new Error(`${data.length} bytes is not a whole number of ${Number(o.width)}-bit units.`);
        const lines = ['index  unsigned   two\'s-comp   sign-magnitude   one\'s-comp', '─'.repeat(58)];
        for (let i = 0; i < data.length; i += w) {
          let u = 0;
          for (let k = 0; k < w; k++) u = u * 256 + data[i + k];
          const bits = Number(o.width);
          const signBit = 2 ** (bits - 1);
          const twos = u >= signBit ? u - 2 ** bits : u;
          const sm = u >= signBit ? -(u % signBit) : u;
          const oc = u >= signBit ? -((2 ** bits - 1) - u) : u;
          const fmt = (n: number) => String(n).padStart(11);
          lines.push(`${String(i / w).padStart(5)}  ${fmt(u)} ${fmt(twos)} ${fmt(sm).padStart(15)} ${fmt(oc)}`);
        }
        return textValue(lines.join('\n'));
      }
    }
  ],
  examples: [{ label: 'Edge bytes', input: '00 7f 80 fe ff' }],
  docs: 'Bytes are grouped big-endian. "Sign-magnitude" and "one\'s complement" each have two zeros (+0 / −0) — one reason two\'s complement won.'
});



defineOp({
  id: 'sign-extension',
  name: 'Sign / Zero Extension',
  category: 'bytes',
  description: 'Widens an integer from N bytes to M bytes, preserving value either as signed (sign-extend) or unsigned (zero-extend). Big-endian display byte order.',
  aliases: ['extend integer', 'sext', 'zext'],
  tags: ['bytes', 'integer', 'width'],
  input: 'text',
  output: 'bytes',
  reversible: false,
  engine: 'typescript',
  options: [
    { type: 'select', key: 'mode', label: 'Mode', default: 'sign', options: [{ value: 'sign', label: 'Sign-extend' }, { value: 'zero', label: 'Zero-extend' }] },
    { type: 'number', key: 'toWidth', label: 'Target bytes', default: 4, min: 1, max: 16 }
  ],
  actions: [
    {
      id: 'apply', label: 'Extend', kind: 'convert',
      run: (v, o) => {
        const data = needHex(v);
        const target = Number(o.toWidth);
        if (target <= data.length) throw new Error(`Target width (${target}) must exceed current width (${data.length}).`);
        const fill = o.mode === 'sign' && (data[0] & 0x80) ? 0xff : 0x00;
        const out = new Uint8Array(target).fill(fill);
        out.set(data, target - data.length);
        return bytesValue(out);
      }
    }
  ],
  examples: [{ label: 'Negative byte', input: 'fe', options: { mode: 'sign', toWidth: 4 } }],
  docs: 'FE (as signed = −2) sign-extends to FF FF FF FE, which is still −2 as a 32-bit two\'s complement value; zero-extension gives 00 00 00 FE (= 254).'
});

/* ------------------------------ float inspectors ---------------------------- */

defineOp({
  id: 'float32-inspector',
  name: 'Float32 Inspector (IEEE 754)',
  category: 'bytes',
  description: '4-byte single-precision float: hex ↔ decimal with full sign/exponent/mantissa breakdown.',
  aliases: ['single precision', 'float32', 'half?'],
  tags: ['bytes', 'float', 'ieee754'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'browser',
  options: [{ type: 'toggle', key: 'littleEndian', label: 'Input bytes are little-endian', default: false }],
  actions: [
    {
      id: 'analyze', label: 'Hex → float', kind: 'convert',
      run: (v, o) => {
        let data = needHex(v);
        if (data.length !== 4) throw new Error(`Float32 needs exactly 4 bytes (you gave ${data.length}).`);
        if (o.littleEndian) data = [...data].reverse() as unknown as Uint8Array;
        const dv = new DataView(new Uint8Array(data).buffer);
        const f = dv.getFloat32(0, false);
        const u = dv.getUint32(0, false);
        const sign = (u >>> 31) & 1;
        const exp = (u >>> 23) & 255;
        const mant = u & 0x7fffff;
        const kind = exp === 255 ? (mant ? 'NaN' : sign ? '−Infinity' : '+Infinity') : exp === 0 ? 'subnormal (denormal)' : 'normal';
        return textValue(
          `Value:    ${f}\nHex:      ${bytesToHex(data, ' ')}\nKind:     ${kind}\nSign:     ${sign} (${sign ? 'negative' : 'positive'})\nExponent: ${exp} (bias 127 → ${exp - 127})\nMantissa: 0x${mant.toString(16).padStart(6, '0')} (${mant}/8,388,608)\nFormula:  (−1)${sign ? '¹' : '⁰'} × ${exp === 0 ? '0' : '1'}.${mant.toString(2).padStart(23, '0').replace(/0+$/, '') || '0'}₂ × 2^${exp === 0 ? -126 : exp - 127}`
        );
      }
    },
    {
      id: 'encode', label: 'Float → hex', kind: 'convert',
      run: (v, o) => {
        const f = Number(v.text.trim());
        if (Number.isNaN(f)) throw new Error('Enter a decimal number.');
        const buf = new ArrayBuffer(4);
        new DataView(buf).setFloat32(0, f, Boolean(o.littleEndian));
        const bytes = new Uint8Array(buf);
        const exact = new DataView(buf).getFloat32(0, Boolean(o.littleEndian));
        return textValue(`${bytesToHex(bytes, ' ')}${o.littleEndian ? '  (little-endian)' : ''}${exact !== f ? `\nNote: stored as ${exact} — float32 can only hold ~7 significant digits.` : ''}`, 'bytes');
      }
    }
  ],
  examples: [{ label: 'Pi', input: '3.14159265' }]
});

defineOp({
  id: 'float16-inspector',
  name: 'Float16 Inspector (half precision)',
  category: 'bytes',
  description: '2-byte IEEE half: hex ↔ decimal with bit breakdown — the ML-era float.',
  aliases: ['half precision', 'fp16', 'half float'],
  tags: ['bytes', 'float', 'ieee754'],
  input: 'text',
  output: 'text',
  reversible: true,
  engine: 'browser',
  actions: [
    {
      id: 'analyze', label: 'Hex → float', kind: 'convert',
      run: (v) => {
        const data = needHex(v);
        if (data.length !== 2) throw new Error('Float16 needs exactly 2 bytes.');
        const u = (data[0] << 8) | data[1];
        const sign = (u >>> 15) & 1, exp = (u >>> 10) & 31, mant = u & 1023;
        let val: number;
        if (exp === 31) val = mant ? NaN : sign ? -Infinity : Infinity;
        else if (exp === 0) val = (sign ? -1 : 1) * (mant / 1024) * 2 ** -14;
        else val = (sign ? -1 : 1) * (1 + mant / 1024) * 2 ** (exp - 15);
        return textValue(
          `Value:    ${Number.isNaN(val) ? 'NaN' : val}\nHex:      ${bytesToHex(data, ' ')}\nSign:     ${sign}\nExponent: ${exp} (bias 15 → ${exp - 15})\nMantissa: ${mant}/1024\n${exp === 0 && mant !== 0 ? 'This is a subnormal — mantissa implicitly 0.something.' : 'Implicit leading 1 (normal range).'}`);
      }
    },
    {
      id: 'encode', label: 'Float → hex', kind: 'convert',
      run: (v) => {
        const f = Number(v.text.trim());
        if (Number.isNaN(f)) throw new Error('Enter a decimal number.');
        return textValue(convertF16(f) + '  (big-endian)', 'bytes');
      }
    }
  ],
  examples: [{ label: 'One', input: '1' }]
});

// minimal correct float32→float16 bit conversion
function convertF16(val: number): string {
  const buf = new ArrayBuffer(4);
  new DataView(buf).setFloat32(0, val, false);
  const x = new DataView(buf).getUint32(0, false);
  const sign = (x >>> 16) & 0x8000;
  let e = ((x >>> 23) & 255) - 112;
  let m = x & 0x7fffff;
  if (e >= 31) return (sign | 0x7bff).toString(16).padStart(4, '0'); // saturate to max half
  if (e <= 0) {
    if (e < -10) return sign.toString(16).padStart(4, '0');
    m = (m | 0x800000) >> (1 - e);
    return (sign | ((m + 1) >> 1)).toString(16).padStart(4, '0');
  }
  return (sign | (e << 10) | (m >> 13)).toString(16).padStart(4, '0');
}

/* ----------------------------- varints & zigzag ----------------------------- */

defineOp({
  id: 'protobuf-varint',
  name: 'Protobuf Varint / ZigZag',
  category: 'bytes',
  description: 'LEB128 variable-length integers (7 data bits per byte, MSB = continuation) and ZigZag signed mapping (0→0, −1→1, 1→2…).',
  aliases: ['leb128', 'zigzag', 'varint', 'protobuf int'],
  tags: ['bytes', 'integer', 'protobuf', 'serialization'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  options: [{ type: 'toggle', key: 'zigzag', label: 'ZigZag (signed) mode', default: false }],
  actions: [
    {
      id: 'encode', label: 'Encode', kind: 'encode',
      run: (v, o) => {
        const nums = v.text.trim().split(/[\s,]+/).map((t) => {
          if (!/^-?\d+$/.test(t)) throw new Error(`"${t}" is not an integer.`);
          return BigInt(t);
        });
        const out: number[] = [];
        const explain: string[] = [];
        for (const n0 of nums) {
          let n = n0;
          if (o.zigzag) n = n >= 0n ? n * 2n : -2n * n - 1n;
          if (n < 0n) throw new Error('Unsigned varint needs non-negative input (enable ZigZag for signed values).');
          const start = out.length;
          do {
            let b = Number(n & 0x7fn);
            n >>= 7n;
            if (n > 0n) b |= 0x80;
            out.push(b);
          } while (n > 0n);
          explain.push(`${n0} → ${out.slice(start).map((b) => b.toString(16).padStart(2, '0')).join(' ')}`);
        }
        return textValue(`${bytesToHex(new Uint8Array(out), ' ')}\n\n${explain.join('\n')}`, 'encoded');
      }
    },
    {
      id: 'decode', label: 'Decode (hex)', kind: 'decode',
      run: (v, o) => {
        const data = needHex({ text: v.text.split(/\n\s*\n/)[0] });
        const out: bigint[] = [];
        let i = 0;
        while (i < data.length) {
          let n = 0n, shift = 0n;
          for (;;) {
            if (i >= data.length) throw new Error('Truncated varint — last byte still has the continuation bit set.');
            const b = data[i++];
            n |= BigInt(b & 0x7f) << shift;
            shift += 7n;
            if (!(b & 0x80)) break;
          }
          if (o.zigzag) n = (n & 1n) ? -((n + 1n) / 2n) : n / 2n;
          out.push(n);
        }
        return textValue(out.join(' '));
      }
    }
  ],
  examples: [{ label: 'A classic', input: '300' }],
  docs: '300 → AC 02 is the canonical protobuf example: low 7 bits of 300 (0101100) + continuation 1, then remaining 2.'
});

/* ---------------------------- nibble & bit tools ---------------------------- */

defineOp({
  id: 'nibble-splitter',
  name: 'Nibble Splitter / Merger',
  category: 'bytes',
  description: 'Splits every byte into its two 4-bit nibbles (printed as two hex digits), or merges pairs back.',
  aliases: ['nibbles', 'half bytes'],
  tags: ['bytes', 'nibble'],
  input: 'text',
  output: 'encoded',
  reversible: true,
  engine: 'typescript',
  actions: [
    {
      id: 'encode', label: 'Split', kind: 'convert',
      run: (v) => {
        const data = needHex(v);
        return textValue([...data].map((b) => `${(b >> 4).toString(16)}${(b & 15).toString(16)}`).join(' '), 'encoded');
      }
    },
    {
      id: 'decode', label: 'Merge', kind: 'convert',
      run: (v) => bytesValue(needHex(v))
    }
  ],
  examples: [{ label: 'Watch', input: 'a5 3c ff' }],
  docs: '"Split" is mostly a visualization — the hex representation IS the nibbles; the merge direction is the real transform.'
});

defineOp({
  id: 'bit-mask-extractor',
  name: 'Bit Mask Extractor',
  category: 'bytes',
  description: 'Pulls a bit range [start, start+length) out of the stream (bit 0 = very first bit, MSB-first) and right-aligns it.',
  aliases: ['extract bits', 'bitfield', 'bit slice'],
  tags: ['bytes', 'bitwise', 'extract'],
  input: 'text',
  output: 'encoded',
  reversible: false,
  engine: 'typescript',
  options: [
    { type: 'number', key: 'start', label: 'Start bit (0 = first)', default: 0, min: 0 },
    { type: 'number', key: 'length', label: 'Number of bits', default: 8, min: 1, max: 64 }
  ],
  actions: [
    {
      id: 'analyze', label: 'Extract', kind: 'analyze',
      run: (v, o) => {
        const data = needHex(v);
        const start = Number(o.start), length = Number(o.length);
        if (start + length > data.length * 8) throw new Error(`Range [${start}, ${start + length}) exceeds the ${data.length * 8}-bit input.`);
        let val = 0n;
        for (let b = start; b < start + length; b++) {
          const byte = data[Math.floor(b / 8)];
          const bit = (byte >> (7 - (b % 8))) & 1;
          val = (val << 1n) | BigInt(bit);
        }
        return textValue(
          `bits [${start}, ${start + length}) of ${bytesToHex(data, ' ')}\n= ${val} (decimal)\n= 0x${val.toString(16)}\n= 0b${val.toString(2).padStart(length, '0')}`
        );
      }
    }
  ],
  examples: [{ label: 'Middle nibble', input: 'ab cd', options: { start: 4, length: 4 } }]
});
