// VR KRYPTA — operation contract.
// Every transformation in the toolkit is described by one strongly-typed
// OperationDefinition. The UI, search, pipelines and tests all consume this
// contract, so adding a new operation never requires touching app code.

export type DataKind = 'text' | 'encoded' | 'bytes' | 'any';

export type ActionKind =
  | 'encode'
  | 'decode'
  | 'convert'
  | 'hash'
  | 'verify'
  | 'compress'
  | 'decompress'
  | 'analyze'
  | 'transform';

export type CategoryId =
  | 'codes'
  | 'ciphers'
  | 'encodings'
  | 'hashing'
  | 'compression'
  | 'bytes'
  | 'text'
  | 'analysis'
  | 'cryptanalysis';

export type EngineId = 'typescript' | 'browser' | 'python';

/** A value flowing through the workspace or a pipeline. */
export interface IOValue {
  kind: DataKind;
  /** Human-readable form. For kind 'bytes' this is the hex rendering. */
  text: string;
  /** Raw bytes when the value is (or can canonically be treated as) binary. */
  bytes?: Uint8Array;
}

export function textValue(text: string, kind: DataKind = 'text'): IOValue {
  return { kind, text };
}

export function bytesValue(bytes: Uint8Array, kind: DataKind = 'bytes'): IOValue {
  return { kind, text: hexRender(bytes), bytes };
}

export function hexRender(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(' ');
}

/** Option field schema — the workspace renders controls from these. */
export type OptionField =
  | { type: 'text'; key: string; label: string; default?: string; placeholder?: string; help?: string }
  | { type: 'number'; key: string; label: string; default: number; min?: number; max?: number; step?: number; help?: string }
  | { type: 'select'; key: string; label: string; options: { value: string; label: string }[]; default: string; help?: string }
  | { type: 'toggle'; key: string; label: string; default: boolean; help?: string };

export interface OpContext {
  /** Calls into the lazily-loaded Pyodide runtime (python/krypta_engine). */
  python: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
}

export interface OpActionDef {
  id: string;
  label: string;
  kind: ActionKind;
  run: (input: IOValue, opts: Record<string, unknown>, ctx: OpContext) => IOValue | Promise<IOValue>;
}

export interface OpExample {
  label: string;
  input: string;
  options?: Record<string, unknown>;
}

export interface OperationDefinition {
  /** Stable kebab-case ID, used in URLs and saved pipelines. Never rename. */
  id: string;
  name: string;
  category: CategoryId;
  description: string;
  aliases?: string[];
  tags?: string[];
  historicalName?: string;
  input: DataKind;
  output: DataKind;
  reversible: boolean;
  /** One-way transform (hash). Never rendered with a decode action. */
  oneWay?: boolean;
  /** May discard information — the loss is documented. */
  lossy?: boolean;
  engine: EngineId;
  options?: OptionField[];
  actions: OpActionDef[];
  examples?: OpExample[];
  docs?: string;
  warnings?: string[];
}

export interface CategoryInfo {
  id: CategoryId;
  name: string;
  blurb: string;
  icon: string;
}

export const CATEGORIES: CategoryInfo[] = [
  { id: 'codes', name: 'Codes & Representations', blurb: 'Morse, Braille, semaphore, tap code, numeric representations and telegraph-era systems.', icon: 'signal' },
  { id: 'ciphers', name: 'Classical Ciphers', blurb: 'Historical substitution, polyalphabetic and transposition ciphers — for study and puzzles, not modern security.', icon: 'key' },
  { id: 'encodings', name: 'Encodings', blurb: 'Base64 and friends, percent encoding, HTML entities, quoted-printable and byte-to-text formats.', icon: 'brackets' },
  { id: 'hashing', name: 'Hashing', blurb: 'One-way digests. Hashing is not encryption — a digest can be verified, never "decoded".', icon: 'fingerprint' },
  { id: 'compression', name: 'Compression', blurb: 'gzip, zlib and DEFLATE streams, produced and consumed locally in your browser.', icon: 'shrink' },
  { id: 'bytes', name: 'Byte Operations', blurb: 'XOR, bitwise transforms, endian conversion, reversal and byte-level inspection.', icon: 'binary' },
  { id: 'text', name: 'Text Transforms', blurb: 'Reversals, case, keyboard and playful character-level transformations.', icon: 'type' },
  { id: 'analysis', name: 'Analysis', blurb: 'Frequency analysis, entropy and statistics to help identify unknown transformations.', icon: 'chart' },
  { id: 'cryptanalysis', name: 'Cryptanalysis & Detection', blurb: 'Statistical attacks on historical ciphers (IC, Kasiski, chi², XOR cracking) and format detection. Educational — they demonstrate why classical systems fell.', icon: 'magnifier' }
];

/** Pipeline compatibility lattice. Unknown bridges are rejected loudly. */
export function isCompatible(out: DataKind, into: DataKind): boolean {
  if (out === 'any' || into === 'any') return true;
  if (out === into) return true;
  // 'encoded' is a subset of text — always usable where text is expected.
  if (out === 'encoded' && into === 'text') return true;
  // Any text can be re-framed as encoded text (it is still just characters).
  if (out === 'text' && into === 'encoded') return true;
  return false;
}

export function defaultOptions(def: OperationDefinition): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (const f of def.options ?? []) o[f.key] = f.default;
  return o;
}
